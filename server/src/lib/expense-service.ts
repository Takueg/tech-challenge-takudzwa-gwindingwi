import { z } from "zod";
import { db, keepDeleted, nextId, type Expense, type ExpenseSplit } from "./db.js";
import { detectExpenseCategory } from "./category.js";
import { badRequest, forbidden, notFound } from "./errors.js";
import { listGroupsForUser } from "./group-service.js";
import { requireGroup, requireGroupForMember, requireNotArchived, userName } from "./guards.js";
import { amountCentsSchema, expenseDescriptionSchema } from "./schemas.js";
import { splitStrategyRegistry } from "./split-strategies/index.js";

const EXPENSE_LIST_LIMIT = 1000;
const ARCHIVED_MESSAGE = "Can't change an expense in an archived group";

export const createExpenseInput = z.object({
  groupId: z.string(),
  description: expenseDescriptionSchema,
  amountCents: amountCentsSchema,
  paidByUserId: z.string(),
});

/** Expenses for a user's app-wide views. Balances and group detail read every expense, archived or not. */
export function listExpensesForUser(userId: string): Expense[] {
  const groupIds = new Set(listGroupsForUser(userId).map((group) => group.id));
  return Array.from(db.expenses.values()).filter((expense) => groupIds.has(expense.groupId));
}

/** Newest first, with the group name for the shared table. Without a group, leaves out archived groups. */
export function listExpenses(userId: string, groupId?: string) {
  if (groupId) requireGroupForMember(groupId, userId);
  const expenses = groupId
    ? Array.from(db.expenses.values()).filter((e) => e.groupId === groupId)
    : listExpensesForUser(userId);
  return expenses
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, EXPENSE_LIST_LIMIT)
    .map((e) => ({ ...e, groupName: db.groups.get(e.groupId)?.name ?? "Unknown" }));
}

export function computeEqualSplits(amountCents: number, memberIds: string[]): ExpenseSplit[] {
  return splitStrategyRegistry.split("equal", { amountCents, memberIds });
}

const peopleOn = (expense: Expense) => expense.splits.map((s) => s.userId);

/** With an expense, previews an edit: that re-splits across the people on it, who may differ from today's members. */
export function previewSplit(input: { groupId: string; amountCents: number; expenseId?: string }): ExpenseSplit[] {
  const group = requireGroup(input.groupId);
  if (!input.expenseId) return computeEqualSplits(input.amountCents, group.memberIds);
  const expense = db.expenses.get(input.expenseId);
  if (expense?.groupId !== group.id) throw notFound(`Expense ${input.expenseId} not found`);
  return computeEqualSplits(input.amountCents, peopleOn(expense));
}

export async function createExpense(input: z.infer<typeof createExpenseInput>): Promise<Expense> {
  // Detection is the only await, so the group and membership checks after it can't go stale.
  const category = await detectExpenseCategory(input.description);

  const group = requireGroup(input.groupId);
  requireNotArchived(group, "Can't add an expense to an archived group");
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
    paidByUserName: userName(input.paidByUserId),
    splits: computeEqualSplits(input.amountCents, group.memberIds),
    category,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  db.expenses.set(expense.id, expense);
  return expense;
}

/** Only the person who paid can change an expense, and not in an archived group. */
function requireChangeable(expense: Expense, userId: string): void {
  requireNotArchived(requireGroup(expense.groupId), ARCHIVED_MESSAGE);
  if (expense.paidByUserId !== userId) throw forbidden("Only the person who paid can change this expense");
}

function requireEditableExpense(expenseId: string, userId: string): Expense {
  const expense = db.expenses.get(expenseId);
  if (!expense) throw notFound(`Expense ${expenseId} not found`);
  requireChangeable(expense, userId);
  return expense;
}

export async function updateExpense(input: {
  expenseId: string;
  userId: string;
  description: string;
  amountCents: number;
  paidByUserId?: string;
}): Promise<Expense> {
  const before = requireEditableExpense(input.expenseId, input.userId);
  const category =
    input.description === before.description ? before.category : await detectExpenseCategory(input.description);

  // Looked up again because the expense may have been deleted or archived during detection.
  const expense = requireEditableExpense(input.expenseId, input.userId);
  if (input.paidByUserId && input.paidByUserId !== expense.paidByUserId) {
    const onExpense = peopleOn(expense).includes(input.paidByUserId);
    if (!onExpense && !requireGroup(expense.groupId).memberIds.includes(input.paidByUserId)) {
      throw badRequest("Payer must be a member of the group");
    }
    expense.paidByUserId = input.paidByUserId;
    expense.paidByUserName = userName(input.paidByUserId);
  }
  if (input.amountCents !== expense.amountCents) {
    // Re-split across the people on this expense, who may differ from today's members.
    expense.splits = computeEqualSplits(input.amountCents, peopleOn(expense));
  }
  expense.description = input.description;
  expense.amountCents = input.amountCents;
  expense.category = category;
  expense.updatedAt = new Date().toISOString();
  return expense;
}

export function deleteExpense(expenseId: string, userId: string): void {
  const expense = requireEditableExpense(expenseId, userId);
  db.expenses.delete(expense.id);
  keepDeleted(db.deletedExpenses, expense);
}

/** Undoes a delete, with the same people and amounts it had. */
export function restoreExpense(expenseId: string, userId: string): Expense {
  const expense = db.deletedExpenses.get(expenseId);
  if (!expense) throw notFound(`Expense ${expenseId} not found`);
  requireChangeable(expense, userId);
  db.deletedExpenses.delete(expense.id);
  db.expenses.set(expense.id, expense);
  return expense;
}
