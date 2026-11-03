import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { computeNetBalances, simplifyDebts } from "../lib/balances.js";
import { db, nextId, type Settlement } from "../lib/db.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { amountCentsSchema } from "../lib/schemas.js";

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

export const settlementsRouter = router({
  /** Every debt involving this user across their active groups, flattened for the dashboard's Settle Up. */
  suggestedForUser: publicProcedure.input(z.object({ userId: z.string() })).query(({ input }) => {
    const nameOf = (userId: string) => db.users.get(userId)?.name ?? "Unknown";
    return Array.from(db.groups.values())
      .filter((group) => !group.archivedAt)
      .flatMap((group) =>
        simplifyDebts(computeNetBalances(group.id))
          .filter((t) => t.fromUserId === input.userId || t.toUserId === input.userId)
          .map((t) => ({
            ...t,
            groupId: group.id,
            groupName: group.name,
            fromName: nameOf(t.fromUserId),
            toName: nameOf(t.toUserId),
          }))
      );
  }),

  create: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        fromUserId: z.string(),
        toUserId: z.string(),
        amountCents: amountCentsSchema,
      })
    )
    .mutation(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw notFound(`Group ${input.groupId} not found`);
      if (group.archivedAt) throw conflict("Can't record a settlement in an archived group");
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
    }),

  delete: publicProcedure.input(z.object({ settlementId: z.string() })).mutation(({ input }) => {
    const settlement = db.settlements.get(input.settlementId);
    if (!settlement) throw notFound(`Settlement ${input.settlementId} not found`);
    if (db.groups.get(settlement.groupId)?.archivedAt) {
      throw conflict("Can't undo a settlement in an archived group");
    }
    db.settlements.delete(input.settlementId);
    db.deletedSettlements.set(settlement.id, settlement);
    return { ok: true };
  }),

  /** Undoes a delete. Balances may have moved since, so the debt is checked again. */
  restore: publicProcedure.input(z.object({ settlementId: z.string() })).mutation(({ input }) => {
    const settlement = db.deletedSettlements.get(input.settlementId);
    if (!settlement) throw notFound(`Settlement ${input.settlementId} not found`);
    const group = db.groups.get(settlement.groupId);
    if (!group) throw notFound(`Group ${settlement.groupId} not found`);
    if (group.archivedAt) throw conflict("Can't undo a settlement in an archived group");
    requireSettleable(settlement.groupId, settlement.fromUserId, settlement.toUserId, settlement.amountCents);
    db.deletedSettlements.delete(settlement.id);
    db.settlements.set(settlement.id, settlement);
    return settlement;
  }),
});
