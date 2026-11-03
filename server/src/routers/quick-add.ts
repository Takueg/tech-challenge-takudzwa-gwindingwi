import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, nextId, type Expense, type ExpenseSplit } from "../lib/db.js";

/** Quick-and-dirty equal split for the quick-add form — doesn't go through the split-strategy registry. */
function splitEvenly(amountCents: number, memberIds: string[]): ExpenseSplit[] {
  const share = Math.floor(amountCents / memberIds.length);
  const remainder = amountCents - share * memberIds.length;
  return memberIds.map((userId, i) => ({
    userId,
    amountCents: share + (i < remainder ? 1 : 0),
  }));
}

export const quickAddRouter = router({
  create: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        description: z.string().min(1),
        amountCents: z.number().int().positive(),
        paidByUserId: z.string(),
      })
    )
    .mutation(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);

      const now = new Date().toISOString();
      const expense: Expense = {
        id: nextId("expense"),
        groupId: input.groupId,
        description: input.description,
        amountCents: input.amountCents,
        currency: "EUR",
        paidByUserId: input.paidByUserId,
        paidByUserName: db.users.get(input.paidByUserId)?.name ?? "Unknown",
        splits: splitEvenly(input.amountCents, group.memberIds),
        category: "Other",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      db.expenses.set(expense.id, expense);

      const existingForGroup = db.groupExpenseCache.get(input.groupId) ?? [];
      db.groupExpenseCache.set(input.groupId, [...existingForGroup, expense]);

      return expense;
    }),
});
