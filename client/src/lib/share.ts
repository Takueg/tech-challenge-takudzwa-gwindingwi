type ExpenseWithSplits = { splits: { userId: string; amountCents: number }[] };

/** What this expense actually charges the user, or undefined if they aren't on it. */
export function shareOf(expense: ExpenseWithSplits, userId: string | null | undefined): number | undefined {
  return expense.splits.find((split) => split.userId === userId)?.amountCents;
}
