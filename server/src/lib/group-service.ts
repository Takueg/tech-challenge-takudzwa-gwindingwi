import { computeNetBalances } from "./balances.js";
import { db, type Group } from "./db.js";

function setArchivedAt(groupId: string, archivedAt: string | undefined): Group {
  const group = db.groups.get(groupId);
  if (!group) throw new Error(`Group ${groupId} not found`);

  group.archivedAt = archivedAt;
  for (const expense of db.expenses.values()) {
    if (expense.groupId === groupId) expense.archivedAt = archivedAt;
  }
  return group;
}

/** A group and its expenses always archive and restore together, so this is the only place that sets archivedAt. */
export function archiveGroup(groupId: string): Group {
  if (computeNetBalances(groupId).some((balance) => balance.netCents !== 0)) {
    throw new Error("Everyone needs to settle up before this group can be archived");
  }
  return setArchivedAt(groupId, new Date().toISOString());
}

export function unarchiveGroup(groupId: string): Group {
  return setArchivedAt(groupId, undefined);
}
