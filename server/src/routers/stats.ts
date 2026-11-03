import { z } from "zod";
import { publicProcedure, router } from "../trpc.js";
import { computeNetBalances } from "../lib/balances.js";
import { db } from "../lib/db.js";
import { listActiveExpenses } from "../lib/expense-service.js";

export const statsRouter = router({
  overview: publicProcedure.query(() => {
    const expenses = listActiveExpenses();
    const categoryTotals: Record<string, number> = {};
    for (const expense of expenses) {
      categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + expense.amountCents;
    }
    return {
      groupCount: Array.from(db.groups.values()).filter((group) => !group.archivedAt).length,
      expenseCount: expenses.length,
      totalCents: expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
      categoryTotals,
    };
  }),

  /** What one user is owed and owes across their active groups. A group's debts don't offset another's. */
  myBalances: publicProcedure.input(z.object({ userId: z.string() })).query(({ input }) => {
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

  leaderboard: publicProcedure.query(() => {
    const totalsByUser = new Map<string, number>();
    for (const expense of listActiveExpenses()) {
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
