import { computeNetBalances } from "./balances.js";
import { db } from "./db.js";
import { listExpensesForUser } from "./expense-service.js";
import { listGroupsForUser } from "./group-service.js";
import { userName } from "./guards.js";

export function getOverview(userId: string) {
  const expenses = listExpensesForUser(userId);
  const categoryTotals: Record<string, number> = {};
  for (const expense of expenses) {
    categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + expense.amountCents;
  }
  return {
    groupCount: listGroupsForUser(userId).length,
    expenseCount: expenses.length,
    totalCents: expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    categoryTotals,
  };
}

/** What one user is owed and owes across their active groups. A group's debts don't offset another's. */
export function getBalancesForUser(userId: string) {
  const perGroup: { groupId: string; netCents: number }[] = [];
  for (const group of db.groups.values()) {
    if (group.archivedAt) continue;
    const balance = computeNetBalances(group.id).find((b) => b.userId === userId);
    if (balance) perGroup.push({ groupId: group.id, netCents: balance.netCents });
  }
  return {
    owedCents: perGroup.reduce((sum, g) => sum + Math.max(g.netCents, 0), 0),
    oweCents: perGroup.reduce((sum, g) => sum + Math.max(-g.netCents, 0), 0),
    perGroup,
  };
}

export function getLeaderboard(userId: string) {
  const totalsByUser = new Map<string, number>();
  for (const expense of listExpensesForUser(userId)) {
    totalsByUser.set(expense.paidByUserId, (totalsByUser.get(expense.paidByUserId) ?? 0) + expense.amountCents);
  }
  return Array.from(totalsByUser.entries())
    .map(([id, totalCents]) => ({ userId: id, userName: userName(id), totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}
