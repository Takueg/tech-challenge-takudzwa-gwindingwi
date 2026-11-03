import { z } from "zod";
import { db, nextId, type Expense, type ExpenseSplit } from "./db.js";
import { detectExpenseCategory } from "./category.js";
import { amountCentsSchema, nonBlankStringSchema } from "./schemas.js";
import { splitStrategyRegistry } from "./split-strategies/index.js";

export const createExpenseInput = z.object({
  groupId: z.string(),
  description: nonBlankStringSchema,
  amountCents: amountCentsSchema,
  paidByUserId: z.string(),
});

/** Expenses for app-wide views. Balances and group detail read every expense, archived or not. */
export function listActiveExpenses(): Expense[] {
  return Array.from(db.expenses.values()).filter((expense) => !expense.archivedAt);
}

export function computeEqualSplits(amountCents: number, memberIds: string[]): ExpenseSplit[] {
  return splitStrategyRegistry.split("equal", { amountCents, memberIds });
}

export async function createExpense(input: z.infer<typeof createExpenseInput>): Promise<Expense> {
  // Detection is the only await. Everything after it runs without yielding, so
  // concurrent creates can't overwrite each other's cache entries, and the
  // group and membership checks can't go stale.
  const category = await detectExpenseCategory(input.description);

  const group = db.groups.get(input.groupId);
  if (!group) throw new Error(`Group ${input.groupId} not found`);
  if (group.archivedAt) throw new Error("Can't add an expense to an archived group");
  if (!group.memberIds.includes(input.paidByUserId)) {
    throw new Error("Payer must be a member of the group");
  }

  const now = new Date().toISOString();
  const expense: Expense = {
    id: nextId("expense"),
    groupId: input.groupId,
    description: input.description,
    amountCents: input.amountCents,
    currency: "EUR",
    paidByUserId: input.paidByUserId,
    paidByUserName: db.users.get(input.paidByUserId)?.name ?? "Unknown",
    splits: computeEqualSplits(input.amountCents, group.memberIds),
    category,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  db.expenses.set(expense.id, expense);
  db.groupExpenseCache.set(input.groupId, [...(db.groupExpenseCache.get(input.groupId) ?? []), expense]);
  return expense;
}
