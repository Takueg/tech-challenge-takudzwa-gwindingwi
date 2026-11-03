/** Quick preview of how an equal split will look while the expense is being entered. */
export function previewEqualSplit(amountCents: number, memberCount: number): number[] {
  if (memberCount <= 0) return [];
  const shareEuros = Math.round((amountCents / 100 / memberCount) * 100) / 100;
  return Array.from({ length: memberCount }, () => shareEuros);
}
