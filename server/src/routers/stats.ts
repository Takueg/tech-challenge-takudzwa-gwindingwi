import { publicProcedure, router } from "../trpc.js";
import { db } from "../lib/db.js";
import { listActiveExpenses } from "../lib/expense-service.js";

export const statsRouter = router({
  overview: publicProcedure.query(() => {
    const expenses = listActiveExpenses();
    return {
      groupCount: Array.from(db.groups.values()).filter((group) => !group.archivedAt).length,
      expenseCount: expenses.length,
      totalCents: expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    };
  }),

  recentExpenses: publicProcedure.query(() => {
    return listActiveExpenses()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
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
