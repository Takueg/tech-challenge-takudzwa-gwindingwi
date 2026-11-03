import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, nextId, type Expense } from "../lib/db.js";
import { detectExpenseCategory } from "../lib/category.js";
import { splitStrategyRegistry } from "../lib/split-strategies/index.js";
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
    .input(z.object({ groupId: z.string(), amountCents: z.number().int().positive() }))
    .query(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);

      // Quick preview math — remainder cents go to the LAST members here,
      // not the first, unlike the actual EqualSplitStrategy used on submit.
      const memberIds = group.memberIds;
      const share = Math.floor(input.amountCents / memberIds.length);
      const remainder = input.amountCents - share * memberIds.length;
      return memberIds.map((userId, i) => ({
        userId,
        amountCents: share + (i >= memberIds.length - remainder ? 1 : 0),
      }));
    }),

  previewBalances: publicProcedure
    .input(z.object({ groupId: z.string(), amountCents: z.number().int().positive(), paidByUserId: z.string() }))
    .query(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);

      const currentBalances = computeNetBalances(input.groupId);
      const net = new Map(currentBalances.map((b) => [b.userId, b.netCents]));

      // Layer the hypothetical expense on top of current balances. Uses its
      // own even-split math (each share rounded independently) rather than
      // going through previewSplit or the real split strategy.
      const memberIds = group.memberIds;
      const roughShare = Math.round(input.amountCents / memberIds.length);
      net.set(input.paidByUserId, (net.get(input.paidByUserId) ?? 0) + input.amountCents);
      for (const userId of memberIds) {
        net.set(userId, (net.get(userId) ?? 0) - roughShare);
      }

      const projectedBalances = Array.from(net.entries()).map(([userId, netCents]) => ({ userId, netCents }));
      return {
        balances: projectedBalances,
        suggestedTransfers: simplifyDebts(projectedBalances),
      };
    }),

  create: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        description: z.string().min(1),
        amountCents: z.number().int().positive(),
        paidByUserId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);
      if (!group.memberIds.includes(input.paidByUserId)) {
        throw new Error("Payer must be a member of the group");
      }

      const existingForGroup = db.groupExpenseCache.get(input.groupId) ?? [];
      const category = await detectExpenseCategory(input.description);

      const splitContext = { amountCents: input.amountCents, memberIds: group.memberIds };
      const strategy = splitStrategyRegistry.resolveByType("equal");
      const validation = strategy.validate(splitContext);
      if (!validation.valid) throw new Error(validation.error);

      const now = new Date().toISOString();
      const expense: Expense = {
        id: nextId("expense"),
        groupId: input.groupId,
        description: input.description,
        amountCents: input.amountCents,
        currency: "EUR",
        paidByUserId: input.paidByUserId,
        paidByUserName: db.users.get(input.paidByUserId)?.name ?? "Unknown",
        splits: strategy.computeSplits(splitContext),
        category,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      db.expenses.set(expense.id, expense);
      db.groupExpenseCache.set(input.groupId, [...existingForGroup, expense]);
      return expense;
    }),

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
