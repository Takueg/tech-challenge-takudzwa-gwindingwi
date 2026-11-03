import { z } from "zod";
import { db, nextId, type Expense, type ExpenseSplit, type Group } from "./db.js";
import { detectExpenseCategory } from "./category.js";
import { amountCentsSchema, nonBlankStringSchema } from "./schemas.js";
import { splitStrategyRegistry } from "./split-strategies/index.js";
import { badRequest, conflict, notFound } from "./errors.js";

export const createExpenseInput = z.object({
  groupId: z.string(),
  description: nonBlankStringSchema,
  amountCents: amountCentsSchema,
  paidByUserId: z.string(),
});

/** A user's active groups: what they can see across the app. */
export function listGroupsForUser(userId: string): Group[] {
  return Array.from(db.groups.values()).filter((group) => !group.archivedAt && group.memberIds.includes(userId));
}

/** Expenses for a user's app-wide views. Balances and group detail read every expense, archived or not. */
export function listExpensesForUser(userId: string): Expense[] {
  const groupIds = new Set(listGroupsForUser(userId).map((group) => group.id));
  return Array.from(db.expenses.values()).filter((expense) => groupIds.has(expense.groupId));
}

export function computeEqualSplits(amountCents: number, memberIds: string[]): ExpenseSplit[] {
  return splitStrategyRegistry.split("equal", { amountCents, memberIds });
}

export async function createExpense(input: z.infer<typeof createExpenseInput>): Promise<Expense> {
  // Detection is the only await, so the group and membership checks after it can't go stale.
  const category = await detectExpenseCategory(input.description);

  const group = db.groups.get(input.groupId);
  if (!group) throw notFound(`Group ${input.groupId} not found`);
  if (group.archivedAt) throw conflict("Can't add an expense to an archived group");
  if (!group.memberIds.includes(input.paidByUserId)) {
    throw badRequest("Payer must be a member of the group");
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
  return expense;
}
