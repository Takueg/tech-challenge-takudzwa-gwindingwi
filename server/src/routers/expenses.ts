import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../lib/db.js";
import { computeEqualSplits, createExpense, createExpenseInput } from "../lib/expense-service.js";
import { amountCentsSchema } from "../lib/schemas.js";
import { computeNetBalances, simplifyDebts } from "../lib/balances.js";

export const expensesRouter = router({
  search: publicProcedure.input(z.object({ query: z.string() })).query(({ input }) => {
    const needle = input.query.trim().toLowerCase();
    if (!needle) return [];
    return Array.from(db.expenses.values())
      .filter((e) => e.description.toLowerCase().includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),

  previewSplit: publicProcedure
    .input(z.object({ groupId: z.string(), amountCents: amountCentsSchema }))
    .query(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);
      return computeEqualSplits(input.amountCents, group.memberIds);
    }),

  previewBalances: publicProcedure
    .input(z.object({ groupId: z.string(), amountCents: amountCentsSchema, paidByUserId: z.string() }))
    .query(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);
      if (!group.memberIds.includes(input.paidByUserId)) {
        throw new Error("Payer must be a member of the group");
      }

      const net = new Map(computeNetBalances(input.groupId).map((b) => [b.userId, b.netCents]));
      net.set(input.paidByUserId, (net.get(input.paidByUserId) ?? 0) + input.amountCents);
      for (const split of computeEqualSplits(input.amountCents, group.memberIds)) {
        net.set(split.userId, (net.get(split.userId) ?? 0) - split.amountCents);
      }

      const projectedBalances = Array.from(net.entries()).map(([userId, netCents]) => ({ userId, netCents }));
      return {
        balances: projectedBalances,
        suggestedTransfers: simplifyDebts(projectedBalances),
      };
    }),

  create: publicProcedure.input(createExpenseInput).mutation(({ input }) => createExpense(input)),

  uploadReceipt: publicProcedure
    .input(z.object({ expenseId: z.string(), receiptUrl: z.string() }))
    .mutation(({ input }) => {
      const expense = db.expenses.get(input.expenseId);
      if (!expense) throw new Error(`Expense ${input.expenseId} not found`);
      expense.receiptUrl = input.receiptUrl;
      return expense;
    }),

  update: publicProcedure
    .input(
      z.object({
        expenseId: z.string(),
        description: z.string().min(1),
        amountCents: z.number().int().positive(),
      })
    )
    .mutation(({ input }) => {
      const expense = db.expenses.get(input.expenseId);
      if (!expense) throw new Error(`Expense ${input.expenseId} not found`);
      expense.description = input.description;
      expense.amountCents = input.amountCents;
      expense.updatedAt = new Date().toISOString();
      return expense;
    }),

  delete: publicProcedure.input(z.object({ expenseId: z.string() })).mutation(({ input }) => {
    const expense = db.expenses.get(input.expenseId);
    if (!expense) throw new Error(`Expense ${input.expenseId} not found`);
    db.expenses.delete(input.expenseId);
    const cached = db.groupExpenseCache.get(expense.groupId) ?? [];
    db.groupExpenseCache.set(
      expense.groupId,
      cached.filter((e) => e.id !== input.expenseId)
    );
    return { ok: true };
  }),
});
