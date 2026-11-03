import { formatCents } from "./format";

type Split = { userId: string; amountCents: number };

/** "Each of the 3 members pays 12,00 €. You'll be owed 24,00 €." Amounts come from the server's split. */
export function splitSentence(splits: Split[], amountCents: number, payerId: string | null): string {
  const amounts = splits.map((split) => split.amountCents);
  const [low, high] = [Math.min(...amounts), Math.max(...amounts)];
  const each = low === high ? formatCents(low) : `${formatCents(low)} or ${formatCents(high)}`;
  const payerShare = splits.find((split) => split.userId === payerId)?.amountCents ?? 0;
  return `Each of the ${splits.length} members pays ${each}. You’ll be owed ${formatCents(amountCents - payerShare)}.`;
}

/** Says where leftover cents went, using how many people the server charged the higher amount. */
export function roundingNote(splits: Split[]): string {
  const low = Math.min(...splits.map((split) => split.amountCents));
  const extra = splits.filter((split) => split.amountCents > low).length;
  if (extra === 0) return "Splits evenly — no rounding needed.";
  return extra === 1
    ? "The extra 1 cent goes to the first person so the total adds up."
    : `The extra ${extra} cents go to the first ${extra} people so the total adds up.`;
}

/** "5 people owe you · you owe 3", or the settled line when there are no debts. */
export function settleHint(owedBy: number, owes: number): string {
  if (owedBy === 0 && owes === 0) return "You’re all settled up";
  return `${owedBy} ${owedBy === 1 ? "person owes" : "people owe"} you · you owe ${owes}`;
}
