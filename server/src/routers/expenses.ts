import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, type Expense } from "../lib/db.js";
import { detectExpenseCategory } from "../lib/category.js";
import { computeEqualSplits, createExpense, createExpenseInput } from "../lib/expense-service.js";
import { amountCentsSchema, nonBlankStringSchema } from "../lib/schemas.js";
import { computeNetBalances, simplifyDebts } from "../lib/balances.js";

function requireExpense(expenseId: string): Expense {
  const expense = db.expenses.get(expenseId);
  if (!expense) throw new Error(`Expense ${expenseId} not found`);
  return expense;
}

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
      const expense = requireExpense(input.expenseId);
      expense.receiptUrl = input.receiptUrl;
      return expense;
    }),

  update: publicProcedure
    .input(
      z.object({
        expenseId: z.string(),
        description: nonBlankStringSchema,
        amountCents: amountCentsSchema,
      })
    )
    .mutation(async ({ input }) => {
      const before = requireExpense(input.expenseId);
      const category =
        input.description === before.description ? before.category : await detectExpenseCategory(input.description);

      // Looked up again because the expense may have been deleted during detection.
      const expense = requireExpense(input.expenseId);
      if (input.amountCents !== expense.amountCents) {
        // Re-split across the people on this expense, who may differ from today's members.
        expense.splits = computeEqualSplits(
          input.amountCents,
          expense.splits.map((s) => s.userId)
        );
      }
      expense.description = input.description;
      expense.amountCents = input.amountCents;
      expense.category = category;
      expense.updatedAt = new Date().toISOString();
      return expense;
    }),

  delete: publicProcedure.input(z.object({ expenseId: z.string() })).mutation(({ input }) => {
    const expense = requireExpense(input.expenseId);
    db.expenses.delete(input.expenseId);
    const cached = db.groupExpenseCache.get(expense.groupId) ?? [];
    db.groupExpenseCache.set(
      expense.groupId,
      cached.filter((e) => e.id !== input.expenseId)
    );
    return { ok: true };
  }),
});
