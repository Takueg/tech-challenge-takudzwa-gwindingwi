import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { detectExpenseCategory } from "../lib/category.js";
import {
  createExpense,
  createExpenseInput,
  deleteExpense,
  listExpenses,
  previewSplit,
  restoreExpense,
  updateExpense,
} from "../lib/expense-service.js";
import { amountCentsSchema, expenseDescriptionSchema, nonBlankStringSchema } from "../lib/schemas.js";

const expenseActionInput = z.object({ expenseId: z.string(), userId: z.string() });

export const expensesRouter = router({
  list: publicProcedure
    .input(z.object({ userId: z.string(), groupId: z.string().optional() }))
    .query(({ input }) => listExpenses(input.userId, input.groupId)),

  detectCategory: publicProcedure
    .input(z.object({ description: nonBlankStringSchema }))
    .query(({ input }) => detectExpenseCategory(input.description)),

  previewSplit: publicProcedure
    .input(z.object({ groupId: z.string(), amountCents: amountCentsSchema, expenseId: z.string().optional() }))
    .query(({ input }) => previewSplit(input)),

  create: publicProcedure.input(createExpenseInput).mutation(({ input }) => createExpense(input)),

  update: publicProcedure
    .input(
      expenseActionInput.extend({
        description: expenseDescriptionSchema,
        amountCents: amountCentsSchema,
        paidByUserId: z.string().optional(),
      })
    )
    .mutation(({ input }) => updateExpense(input)),

  delete: publicProcedure.input(expenseActionInput).mutation(({ input }) => {
    deleteExpense(input.expenseId, input.userId);
    return { ok: true };
  }),

  restore: publicProcedure
    .input(expenseActionInput)
    .mutation(({ input }) => restoreExpense(input.expenseId, input.userId)),
});
