import { publicProcedure, router } from "../trpc.js";
import { db } from "../lib/db.js";

export const statsRouter = router({
  overview: publicProcedure.query(() => {
    let expenseCount = 0;
    let totalCents = 0;
    for (const expense of db.expenses.values()) {
      expenseCount += 1;
      totalCents += expense.amountCents;
    }
    return {
      groupCount: db.groups.size,
      expenseCount,
      totalCents,
    };
  }),

  recentExpenses: publicProcedure.query(() => {
    return Array.from(db.expenses.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }),

  leaderboard: publicProcedure.query(() => {
    const totalsByUser = new Map<string, number>();
    for (const expense of db.expenses.values()) {
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
