import { computeNetBalances } from "./balances.js";
import { db, type Group } from "./db.js";
import { conflict, notFound } from "./errors.js";

function requireGroup(groupId: string): Group {
  const group = db.groups.get(groupId);
  if (!group) throw notFound(`Group ${groupId} not found`);
  return group;
}

function requireSettled(groupId: string, action: string): void {
  if (computeNetBalances(groupId).some((balance) => balance.netCents !== 0)) {
    throw conflict(`Everyone needs to settle up before this group can be ${action}`);
  }
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
  for (const expense of db.expenses.values()) {
    if (expense.groupId === groupId) db.expenses.delete(expense.id);
  }
  for (const settlement of db.settlements.values()) {
    if (settlement.groupId === groupId) db.settlements.delete(settlement.id);
  }
}
