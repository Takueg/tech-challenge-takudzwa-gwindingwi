import { computeNetBalances, simplifyDebts } from "./balances.js";
import { db, nextId, type Settlement } from "./db.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { requireGroup, requireNotArchived, userName } from "./guards.js";

/** Throws unless the two people have a debt this payment fits within. */
function requireSettleable(groupId: string, fromUserId: string, toUserId: string, amountCents: number): void {
  // Balances list every member plus any former member still owed or owing,
  // so a former member's debt can still be settled.
  const balances = computeNetBalances(groupId);
  const payer = balances.find((b) => b.userId === fromUserId);
  const receiver = balances.find((b) => b.userId === toUserId);
  if (!payer || !receiver) throw badRequest("Payer and receiver must be part of the group");

  if (payer.netCents >= 0) throw conflict("The payer doesn't owe anything");
  if (receiver.netCents <= 0) throw conflict("The receiver isn't owed anything");
  const maxCents = Math.min(-payer.netCents, receiver.netCents);
  if (amountCents > maxCents) {
    throw conflict(`That's more than is owed. The most that can be settled here is ${(maxCents / 100).toFixed(2)} EUR.`);
  }
}

/** Every debt involving this user across their active groups, flattened for the dashboard's Settle Up. */
export function listDebtsForUser(userId: string) {
  return Array.from(db.groups.values())
    .filter((group) => !group.archivedAt)
    .flatMap((group) =>
      simplifyDebts(computeNetBalances(group.id))
        .filter((t) => t.fromUserId === userId || t.toUserId === userId)
        .map((t) => ({
          ...t,
          groupId: group.id,
          groupName: group.name,
          fromName: userName(t.fromUserId),
          toName: userName(t.toUserId),
        }))
    );
}

export function createSettlement(input: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}): Settlement {
  const group = requireGroup(input.groupId);
  requireNotArchived(group, "Can't record a settlement in an archived group");
  if (input.fromUserId === input.toUserId) throw badRequest("Payer and receiver must be different people");

  requireSettleable(input.groupId, input.fromUserId, input.toUserId, input.amountCents);

  const settlement: Settlement = {
    id: nextId("settlement"),
    groupId: input.groupId,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    amountCents: input.amountCents,
    createdAt: new Date().toISOString(),
  };
  db.settlements.set(settlement.id, settlement);
  return settlement;
}

const UNDO_ARCHIVED_MESSAGE = "Can't undo a settlement in an archived group";

export function deleteSettlement(settlementId: string): void {
  const settlement = db.settlements.get(settlementId);
  if (!settlement) throw notFound(`Settlement ${settlementId} not found`);
  requireNotArchived(requireGroup(settlement.groupId), UNDO_ARCHIVED_MESSAGE);
  db.settlements.delete(settlementId);
  db.deletedSettlements.set(settlement.id, settlement);
}

/** Undoes a delete. Balances may have moved since, so the debt is checked again. */
export function restoreSettlement(settlementId: string): Settlement {
  const settlement = db.deletedSettlements.get(settlementId);
  if (!settlement) throw notFound(`Settlement ${settlementId} not found`);
  requireNotArchived(requireGroup(settlement.groupId), UNDO_ARCHIVED_MESSAGE);
  requireSettleable(settlement.groupId, settlement.fromUserId, settlement.toUserId, settlement.amountCents);
  db.deletedSettlements.delete(settlement.id);
  db.settlements.set(settlement.id, settlement);
  return settlement;
}
