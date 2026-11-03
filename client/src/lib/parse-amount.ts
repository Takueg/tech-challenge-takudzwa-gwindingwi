/** Parses a user-entered amount (accepts "12.50" or "12,50") into integer cents. */
export function parseAmountToCents(input: string): number {
  const normalized = input.replace(",", ".");
  return Math.round(Number(normalized) * 100);
}
