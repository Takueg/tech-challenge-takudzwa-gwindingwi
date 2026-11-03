import { csvField } from "./csv";
import { formatClock, formatIsoDate } from "./format";

export type TableExpense = {
  id: string;
  description: string;
  category: string;
  createdAt: string;
  amountCents: number;
  paidByUserId: string;
  paidByUserName: string;
  groupName: string;
  splits: { userId: string; amountCents: number }[];
};

export type ExpenseRow = TableExpense & {
  mine: boolean;
  involved: boolean;
  /** What the viewer is up or down on this expense, from the server's split. */
  shareCents: number;
};

export type SortKey = "title" | "date" | "group" | "payer" | "amount" | "share";
export type ExpenseSort = { key: SortKey; direction: "asc" | "desc" };

export const ALL_GROUPS = "All Groups";
export const ALL_CATEGORIES = "All Categories";
export const CATEGORIES = ["Food", "Rent", "Lodging", "Travel", "Fun", "Other"];
const PAGE_SIZE = 10;
export const DEFAULT_SORT: ExpenseSort = { key: "date", direction: "desc" };

type ExpenseFilters = { query: string; group: string; category: string };

export function toRows(expenses: TableExpense[], currentUserId: string | null): ExpenseRow[] {
  return expenses.map((expense) => {
    const split = expense.splits.find((s) => s.userId === currentUserId)?.amountCents ?? 0;
    const mine = expense.paidByUserId === currentUserId;
    return {
      ...expense,
      mine,
      involved: mine || split > 0,
      shareCents: mine ? expense.amountCents - split : 0 - split,
    };
  });
}

export function filterRows(rows: ExpenseRow[], { query, group, category }: ExpenseFilters): ExpenseRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (group !== ALL_GROUPS && row.groupName !== group) return false;
    if (category !== ALL_CATEGORIES && row.category !== category) return false;
    if (!needle) return true;
    const payer = row.mine ? `you ${row.paidByUserName}` : row.paidByUserName;
    return [row.description, row.groupName, payer].join(" ").toLowerCase().includes(needle);
  });
}

const SORT_VALUE: Record<SortKey, (row: ExpenseRow) => string | number> = {
  title: (row) => row.description.toLowerCase(),
  date: (row) => row.createdAt,
  group: (row) => row.groupName.toLowerCase(),
  payer: (row) => (row.mine ? "you" : row.paidByUserName.toLowerCase()),
  amount: (row) => row.amountCents,
  share: (row) => row.shareCents,
};

/** Ties fall back to newest first, so the order never depends on where a row started. */
export function sortRows(rows: ExpenseRow[], { key, direction }: ExpenseSort): ExpenseRow[] {
  const value = SORT_VALUE[key];
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [left, right] = [value(a), value(b)];
    if (left < right) return -sign;
    if (left > right) return sign;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Clicking a new column starts text ascending and numbers descending; clicking it again flips. */
export function nextSort(current: ExpenseSort, key: SortKey): ExpenseSort {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: key === "title" || key === "group" || key === "payer" ? "asc" : "desc" };
}

/** One page of rows. An out-of-range page lands on the last one, e.g. after deleting its only row. */
export function paginate<T>(rows: T[], page: number, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { page: current, pageCount, rows: rows.slice((current - 1) * pageSize, current * pageSize) };
}

const euros = (cents: number) => (cents / 100).toFixed(2);

/** Text goes through csvField, which stops spreadsheets running it as a formula. Amounts stay plain numbers. */
export function rowsToCsv(rows: ExpenseRow[]): string {
  const header = ["Date", "Time", "Expense", "Category", "Group", "Paid By", "Amount (EUR)", "Your Share (EUR)"];
  const lines = rows.map((row) =>
    [
      csvField(formatIsoDate(row.createdAt)),
      csvField(formatClock(row.createdAt)),
      csvField(row.description),
      csvField(row.category),
      csvField(row.groupName),
      csvField(row.mine ? "You" : row.paidByUserName),
      euros(row.amountCents),
      euros(row.shareCents),
    ].join(",")
  );
  return [header.map(csvField).join(","), ...lines].join("\r\n");
}

/** "Weekend Trip" becomes "weekend-trip", for file names. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
