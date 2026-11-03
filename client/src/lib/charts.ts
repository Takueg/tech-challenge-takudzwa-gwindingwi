export type PieSlice = { label: string; value: number };

/** Largest first. More than three categories become the top two plus "Everything Else", so the chart stays readable. */
export function toPieSlices(categoryTotals: Record<string, number>): PieSlice[] {
  const slices = Object.entries(categoryTotals)
    .map(([label, value]) => ({ label, value }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
  if (slices.length <= 3) return slices;
  const rest = slices.slice(2).reduce((sum, slice) => sum + slice.value, 0);
  return [...slices.slice(0, 2), { label: "Everything Else", value: rest }];
}

export type SpenderRow = { userId: string; userName: string; totalCents: number };

/** Totals per payer, biggest first. */
export function spendersFromExpenses(
  expenses: { paidByUserId: string; paidByUserName: string; amountCents: number }[]
): SpenderRow[] {
  const byUser = new Map<string, SpenderRow>();
  for (const { paidByUserId, paidByUserName, amountCents } of expenses) {
    const row = byUser.get(paidByUserId) ?? { userId: paidByUserId, userName: paidByUserName, totalCents: 0 };
    row.totalCents += amountCents;
    byUser.set(paidByUserId, row);
  }
  return [...byUser.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/** Bar width against the top spender. Never under 2%, so everyone listed has a visible bar. */
export function barPercent(cents: number, topCents: number): number {
  return Math.max(2, Math.round((cents / Math.max(topCents, 1)) * 100));
}
