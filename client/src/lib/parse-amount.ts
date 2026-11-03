const MAX_CENTS = 10_000_000;
const PLAIN = /^(\d+)(?:[.,](\d{1,2}))?$/;
const GROUPED = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;

export type ParsedAmount = { cents: number; error?: undefined } | { cents?: undefined; error: string };

/** Parses what someone typed ("12,50", "12.50", "1.234,50 €") into integer cents, or says what's wrong. */
export function parseAmount(raw: string): ParsedAmount {
  const input = raw.replace(/[\s€]/g, "");
  if (!input) return { error: "Enter an amount" };

  const match = PLAIN.exec(input) ?? GROUPED.exec(input);
  if (!match) return { error: "Use numbers only, like 12,50" };

  const euros = Number(match[1].replace(/\./g, ""));
  const cents = euros * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents <= 0) return { error: "Amount must be more than 0,00 €" };
  if (cents > MAX_CENTS) return { error: "That’s over 100.000,00 € — check the amount" };
  return { cents };
}
