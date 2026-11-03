import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, type Expense } from "../lib/db.js";
import { detectExpenseCategory } from "../lib/category.js";
import { computeEqualSplits, createExpense, createExpenseInput, listActiveExpenses } from "../lib/expense-service.js";
import { amountCentsSchema, nonBlankStringSchema } from "../lib/schemas.js";
import { computeNetBalances, simplifyDebts } from "../lib/balances.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";

function requireEditableExpense(expenseId: string): Expense {
  const expense = db.expenses.get(expenseId);
  if (!expense) throw notFound(`Expense ${expenseId} not found`);
  if (db.groups.get(expense.groupId)?.archivedAt) throw conflict("Can't change an expense in an archived group");
  return expense;
}

const EXPENSE_LIST_LIMIT = 1000;

export const expensesRouter = router({
  /** Newest first, with the group name for the shared table. Without a group, leaves out archived groups. */
  list: publicProcedure.input(z.object({ groupId: z.string().optional() })).query(({ input }) => {
    const { groupId } = input;
    if (groupId && !db.groups.has(groupId)) throw notFound(`Group ${groupId} not found`);
    const expenses = groupId
      ? Array.from(db.expenses.values()).filter((e) => e.groupId === groupId)
      : listActiveExpenses();
    return expenses
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, EXPENSE_LIST_LIMIT)
      .map((e) => ({ ...e, groupName: db.groups.get(e.groupId)?.name ?? "Unknown" }));
  }),

  detectCategory: publicProcedure
    .input(z.object({ description: nonBlankStringSchema }))
    .query(({ input }) => detectExpenseCategory(input.description)),

  search: publicProcedure.input(z.object({ query: z.string() })).query(({ input }) => {
    const needle = input.query.trim().toLowerCase();
    if (!needle) return [];
    return listActiveExpenses()
      .filter((e) => e.description.toLowerCase().includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),

  previewSplit: publicProcedure
    .input(z.object({ groupId: z.string(), amountCents: amountCentsSchema }))
    .query(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw notFound(`Group ${input.groupId} not found`);
      return computeEqualSplits(input.amountCents, group.memberIds);
    }),

  previewBalances: publicProcedure
    .input(z.object({ groupId: z.string(), amountCents: amountCentsSchema, paidByUserId: z.string() }))
    .query(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw notFound(`Group ${input.groupId} not found`);
      if (!group.memberIds.includes(input.paidByUserId)) {
        throw badRequest("Payer must be a member of the group");
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
      const expense = requireEditableExpense(input.expenseId);
      expense.receiptUrl = input.receiptUrl;
      return expense;
    }),

  update: publicProcedure
    .input(
      z.object({
        expenseId: z.string(),
        description: nonBlankStringSchema,
        amountCents: amountCentsSchema,
        paidByUserId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const before = requireEditableExpense(input.expenseId);
      const category =
        input.description === before.description ? before.category : await detectExpenseCategory(input.description);

      // Looked up again because the expense may have been deleted or archived during detection.
      const expense = requireEditableExpense(input.expenseId);
      if (input.paidByUserId && input.paidByUserId !== expense.paidByUserId) {
        const onExpense = expense.splits.some((s) => s.userId === input.paidByUserId);
        if (!onExpense && !db.groups.get(expense.groupId)?.memberIds.includes(input.paidByUserId)) {
          throw badRequest("Payer must be a member of the group");
        }
        expense.paidByUserId = input.paidByUserId;
        expense.paidByUserName = db.users.get(input.paidByUserId)?.name ?? "Unknown";
      }
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
    const expense = requireEditableExpense(input.expenseId);
    db.expenses.delete(expense.id);
    db.deletedExpenses.set(expense.id, expense);
    return { ok: true };
  }),

  /** Undoes a delete, with the same people and amounts it had. */
  restore: publicProcedure.input(z.object({ expenseId: z.string() })).mutation(({ input }) => {
    const expense = db.deletedExpenses.get(input.expenseId);
    if (!expense) throw notFound(`Expense ${input.expenseId} not found`);
    const group = db.groups.get(expense.groupId);
    if (!group) throw notFound(`Group ${expense.groupId} not found`);
    if (group.archivedAt) throw conflict("Can't change an expense in an archived group");
    db.deletedExpenses.delete(expense.id);
    db.expenses.set(expense.id, expense);
    return expense;
  }),
});
