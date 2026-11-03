export function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-03" in the viewer's timezone, for file names and exports. */
export function formatIsoDate(value: string | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Nov 3" */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

/** "09:14" */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "14:02 - Oct 29" */
export function formatTimestamp(iso: string): string {
  return `${formatClock(iso)} - ${formatShortDate(iso)}`;
}

/** The value an amount field shows for an existing amount: "12,50". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
