import { computeNetBalances } from "./balances.js";
import { db, type Group } from "./db.js";

function requireGroup(groupId: string): Group {
  const group = db.groups.get(groupId);
  if (!group) throw new Error(`Group ${groupId} not found`);
  return group;
}

function requireSettled(groupId: string, action: string): void {
  if (computeNetBalances(groupId).some((balance) => balance.netCents !== 0)) {
    throw new Error(`Everyone needs to settle up before this group can be ${action}`);
  }
}

function setArchivedAt(group: Group, archivedAt: string | undefined): Group {
  group.archivedAt = archivedAt;
  for (const expense of db.expenses.values()) {
    if (expense.groupId === group.id) expense.archivedAt = archivedAt;
  }
  return group;
}

/** A group and its expenses always archive and restore together, so this is the only place that sets archivedAt. */
export function archiveGroup(groupId: string): Group {
  const group = requireGroup(groupId);
  requireSettled(groupId, "archived");
  return setArchivedAt(group, new Date().toISOString());
}

export function unarchiveGroup(groupId: string): Group {
  return setArchivedAt(requireGroup(groupId), undefined);
}

/** Refused while anyone owes money, because deleting erases the only record of the debt. */
export function deleteGroup(groupId: string): void {
  requireGroup(groupId);
  requireSettled(groupId, "deleted");
  db.groups.delete(groupId);
  db.groupExpenseCache.delete(groupId);
  for (const expense of db.expenses.values()) {
    if (expense.groupId === groupId) db.expenses.delete(expense.id);
  }
  for (const settlement of db.settlements.values()) {
    if (settlement.groupId === groupId) db.settlements.delete(settlement.id);
  }
}
