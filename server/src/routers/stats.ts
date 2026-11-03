import { z } from "zod";
import { publicProcedure, router } from "../trpc.js";
import { computeNetBalances } from "../lib/balances.js";
import { db } from "../lib/db.js";
import { listExpensesForUser, listGroupsForUser } from "../lib/expense-service.js";

const userInput = z.object({ userId: z.string() });

export const statsRouter = router({
  overview: publicProcedure.input(userInput).query(({ input }) => {
    const expenses = listExpensesForUser(input.userId);
    const categoryTotals: Record<string, number> = {};
    for (const expense of expenses) {
      categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + expense.amountCents;
    }
    return {
      groupCount: listGroupsForUser(input.userId).length,
      expenseCount: expenses.length,
      totalCents: expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
      categoryTotals,
    };
  }),

  /** What one user is owed and owes across their active groups. A group's debts don't offset another's. */
  myBalances: publicProcedure.input(userInput).query(({ input }) => {
    const perGroup: { groupId: string; netCents: number }[] = [];
    for (const group of db.groups.values()) {
      if (group.archivedAt) continue;
      const balance = computeNetBalances(group.id).find((b) => b.userId === input.userId);
      if (balance) perGroup.push({ groupId: group.id, netCents: balance.netCents });
    }
    return {
      owedCents: perGroup.reduce((sum, g) => sum + Math.max(g.netCents, 0), 0),
      oweCents: perGroup.reduce((sum, g) => sum + Math.max(-g.netCents, 0), 0),
      perGroup,
    };
  }),

  leaderboard: publicProcedure.input(userInput).query(({ input }) => {
    const totalsByUser = new Map<string, number>();
    for (const expense of listExpensesForUser(input.userId)) {
      totalsByUser.set(expense.paidByUserId, (totalsByUser.get(expense.paidByUserId) ?? 0) + expense.amountCents);
    }
    return Array.from(totalsByUser.entries())
      .map(([userId, totalCents]) => ({
        userId,
        userName: db.users.get(userId)?.name ?? "Unknown",
        totalCents,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }),
});
