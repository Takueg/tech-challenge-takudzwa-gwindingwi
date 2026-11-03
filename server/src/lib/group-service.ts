import { computeNetBalances, simplifyDebts } from "./balances.js";
import { db, nextId, toPublicUser, type Expense, type Group, type Settlement } from "./db.js";
import { badRequest, conflict } from "./errors.js";
import { requireGroup, requireGroupForMember, requireNotArchived, requireUser } from "./guards.js";

function requireSettled(groupId: string, action: string): void {
  if (computeNetBalances(groupId).some((balance) => balance.netCents !== 0)) {
    throw conflict(`Everyone needs to settle up before this group can be ${action}`);
  }
}

/** A user's active groups: what they can see across the app. */
export function listGroupsForUser(userId: string): Group[] {
  return Array.from(db.groups.values()).filter((group) => !group.archivedAt && group.memberIds.includes(userId));
}

function withTotals(group: Group) {
  let expenseCount = 0;
  let totalCents = 0;
  let lastActivityAt = group.createdAt;
  for (const expense of db.expenses.values()) {
    if (expense.groupId !== group.id) continue;
    expenseCount += 1;
    totalCents += expense.amountCents;
    if (expense.updatedAt > lastActivityAt) lastActivityAt = expense.updatedAt;
  }
  for (const settlement of db.settlements.values()) {
    if (settlement.groupId === group.id && settlement.createdAt > lastActivityAt) {
      lastActivityAt = settlement.createdAt;
    }
  }
  return { ...group, expenseCount, totalCents, lastActivityAt };
}

export function listGroupSummaries(userId: string) {
  return listGroupsForUser(userId).map(withTotals);
}

export function listArchivedGroupSummaries(userId: string) {
  return Array.from(db.groups.values())
    .filter((group) => group.archivedAt && group.memberIds.includes(userId))
    .map(withTotals);
}

/** People on this group's history who have since left. Name only, since the UI just needs to label them. */
function listFormerMembers(group: Group, expenses: Expense[], settlements: Settlement[]) {
  const involvedIds = new Set([
    ...expenses.flatMap((e) => [e.paidByUserId, ...e.splits.map((s) => s.userId)]),
    ...settlements.flatMap((s) => [s.fromUserId, s.toUserId]),
  ]);
  return Array.from(involvedIds)
    .filter((id) => !group.memberIds.includes(id))
    .map((id) => db.users.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map(({ id, name }) => ({ id, name }));
}

export function getGroupDetail(groupId: string, userId: string) {
  const group = requireGroupForMember(groupId, userId);

  const members = group.memberIds
    .map((id) => db.users.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map(toPublicUser);

  const expenses = Array.from(db.expenses.values())
    .filter((e) => e.groupId === group.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({ ...e, archivedAt: group.archivedAt }));

  const settlements = Array.from(db.settlements.values())
    .filter((s) => s.groupId === group.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const categoryTotals: Record<string, number> = {};
  for (const expense of expenses) {
    categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + expense.amountCents;
  }

  const balances = computeNetBalances(group.id);
  const suggestedTransfers = simplifyDebts(balances);
  const formerMembers = listFormerMembers(group, expenses, settlements);

  return { group, members, formerMembers, expenses, settlements, balances, suggestedTransfers, categoryTotals };
}

export function createGroup(input: { name: string; memberIds: string[] }): Group {
  const memberIds = [...new Set(input.memberIds)];
  memberIds.forEach(requireUser);

  const group: Group = {
    id: nextId("group"),
    name: input.name,
    memberIds,
    createdAt: new Date().toISOString(),
  };
  db.groups.set(group.id, group);
  return group;
}

/** All or nothing, so a bad id can't leave the group half updated. */
export function addMembers(groupId: string, userIds: string[]): Group {
  const group = requireGroup(groupId);
  requireNotArchived(group, "Can't add members to an archived group");
  userIds.forEach(requireUser);
  group.memberIds = [...new Set([...group.memberIds, ...userIds])];
  return group;
}

/** All or nothing, for the same reason as addMembers. */
export function removeMembers(groupId: string, userIds: string[]): Group {
  const group = requireGroup(groupId);
  requireNotArchived(group, "Can't remove members from an archived group");
  if (userIds.some((userId) => !group.memberIds.includes(userId))) {
    throw badRequest("That person isn't a member of this group");
  }
  const remaining = group.memberIds.filter((id) => !userIds.includes(id));
  if (remaining.length === 0) throw conflict("Can't remove the last member of a group");
  const balances = computeNetBalances(group.id);
  if (balances.some((b) => userIds.includes(b.userId) && b.netCents !== 0)) {
    throw conflict("This member still has an outstanding balance. Settle up before removing them.");
  }
  group.memberIds = remaining;
  return group;
}

/** An expense's archived status comes from its group, so they can't disagree. */
export function archiveGroup(groupId: string): Group {
  const group = requireGroup(groupId);
  requireSettled(groupId, "archived");
  group.archivedAt = new Date().toISOString();
  return group;
}

export function unarchiveGroup(groupId: string): Group {
  const group = requireGroup(groupId);
  group.archivedAt = undefined;
  return group;
}

/** Refused while anyone owes money, because deleting erases the only record of the debt. */
export function deleteGroup(groupId: string): void {
  requireGroup(groupId);
  requireSettled(groupId, "deleted");
  db.groups.delete(groupId);
  for (const store of [db.expenses, db.deletedExpenses, db.settlements, db.deletedSettlements]) {
    for (const record of store.values()) {
      if (record.groupId === groupId) store.delete(record.id);
    }
  }
}
