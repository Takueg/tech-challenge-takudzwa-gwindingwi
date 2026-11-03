import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ALL_CATEGORIES,
  ALL_GROUPS,
  filterRows,
  nextSort,
  paginate,
  rowsToCsv,
  slugify,
  sortRows,
  toRows,
  type TableExpense,
} from "./expense-table";

function expense(overrides: Partial<TableExpense> = {}): TableExpense {
  return {
    id: "e1",
    description: "Dinner",
    category: "Food",
    createdAt: "2026-07-01T10:00:00.000Z",
    amountCents: 3000,
    paidByUserId: "bob",
    paidByUserName: "Bob",
    groupName: "Trip",
    splits: [
      { userId: "alice", amountCents: 1000 },
      { userId: "bob", amountCents: 1000 },
      { userId: "carol", amountCents: 1000 },
    ],
    ...overrides,
  };
}

const noFilters = { query: "", group: ALL_GROUPS, category: ALL_CATEGORIES };

describe("toRows", () => {
  it("shows a negative share when someone else paid", () => {
    expect(toRows([expense()], "alice")[0]).toMatchObject({ mine: false, involved: true, shareCents: -1000 });
  });

  it("shows what you lent when you paid", () => {
    expect(toRows([expense({ paidByUserId: "alice" })], "alice")[0]).toMatchObject({
      mine: true,
      involved: true,
      shareCents: 2000,
    });
  });

  it("uses the server's split, including leftover cents", () => {
    const uneven = expense({
      amountCents: 100,
      splits: [
        { userId: "alice", amountCents: 34 },
        { userId: "bob", amountCents: 33 },
        { userId: "carol", amountCents: 33 },
      ],
    });
    expect(toRows([uneven], "alice")[0].shareCents).toBe(-34);
    expect(toRows([uneven], "carol")[0].shareCents).toBe(-33);
  });

  it("marks someone not on the expense as not involved", () => {
    expect(toRows([expense()], "dave")[0]).toMatchObject({ involved: false, shareCents: 0 });
  });

  it("counts a payer who isn't on the split as lending the full amount", () => {
    expect(toRows([expense({ paidByUserId: "dave", paidByUserName: "Dave" })], "dave")[0]).toMatchObject({
      involved: true,
      shareCents: 3000,
    });
  });
});

describe("filterRows", () => {
  const rows = toRows(
    [
      expense({ id: "a", description: "Pizza night" }),
      expense({ id: "b", description: "Taxi", category: "Travel", groupName: "Flat" }),
      expense({ id: "c", description: "Rent", category: "Rent", paidByUserId: "alice", paidByUserName: "Alice" }),
    ],
    "alice"
  );
  const ids = (filters: Partial<typeof noFilters>) =>
    filterRows(rows, { ...noFilters, ...filters }).map((row) => row.id);

  it("returns everything with no filters", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
  });

  it("searches the description, ignoring case", () => {
    expect(ids({ query: "PIZZA" })).toEqual(["a"]);
  });

  it("searches the group", () => {
    expect(ids({ query: "flat" })).toEqual(["b"]);
  });

  it("searches the payer, including 'you' for the viewer", () => {
    expect(ids({ query: "bob" })).toEqual(["a", "b"]);
    expect(ids({ query: "you" })).toEqual(["c"]);
  });

  it("filters by group and by category together", () => {
    expect(ids({ group: "Trip" })).toEqual(["a", "c"]);
    expect(ids({ group: "Trip", category: "Rent" })).toEqual(["c"]);
    expect(ids({ group: "Flat", category: "Rent" })).toEqual([]);
  });
});

describe("sortRows", () => {
  const rows = toRows(
    [
      expense({ id: "old", description: "banana", createdAt: "2026-01-01T00:00:00.000Z", amountCents: 900 }),
      expense({ id: "new", description: "Apple", createdAt: "2026-03-01T00:00:00.000Z", amountCents: 300 }),
      expense({ id: "mid", description: "cherry", createdAt: "2026-02-01T00:00:00.000Z", amountCents: 300 }),
    ],
    "alice"
  );
  const ids = (key: Parameters<typeof nextSort>[1], direction: "asc" | "desc") =>
    sortRows(rows, { key, direction }).map((row) => row.id);

  it("sorts by date both ways", () => {
    expect(ids("date", "desc")).toEqual(["new", "mid", "old"]);
    expect(ids("date", "asc")).toEqual(["old", "mid", "new"]);
  });

  it("sorts text without regard to case", () => {
    expect(ids("title", "asc")).toEqual(["new", "old", "mid"]);
  });

  it("breaks ties newest first", () => {
    expect(ids("amount", "asc")).toEqual(["new", "mid", "old"]);
    expect(ids("amount", "desc")).toEqual(["old", "new", "mid"]);
  });

  it("sorts by share as a signed number", () => {
    const mixed = toRows(
      [expense({ id: "borrowed" }), expense({ id: "lent", paidByUserId: "alice", paidByUserName: "Alice" })],
      "alice"
    );
    expect(sortRows(mixed, { key: "share", direction: "desc" }).map((r) => r.id)).toEqual(["lent", "borrowed"]);
  });

  it("doesn't mutate its input", () => {
    const before = rows.map((r) => r.id);
    sortRows(rows, { key: "title", direction: "asc" });
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("nextSort", () => {
  it("starts text columns ascending and number columns descending", () => {
    const current = { key: "date", direction: "desc" } as const;
    expect(nextSort(current, "title")).toEqual({ key: "title", direction: "asc" });
    expect(nextSort(current, "amount")).toEqual({ key: "amount", direction: "desc" });
  });

  it("flips the column already sorted", () => {
    expect(nextSort({ key: "date", direction: "desc" }, "date").direction).toBe("asc");
    expect(nextSort({ key: "date", direction: "asc" }, "date").direction).toBe("desc");
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it("slices ten rows per page", () => {
    expect(paginate(items, 2)).toMatchObject({ page: 2, pageCount: 3 });
    expect(paginate(items, 2).rows).toEqual(items.slice(10, 20));
    expect(paginate(items, 3).rows).toEqual(items.slice(20));
  });

  it("lands on the last page when the page is out of range", () => {
    expect(paginate(items, 9).page).toBe(3);
  });

  it("still has one page with no rows", () => {
    expect(paginate([], 1)).toEqual({ page: 1, pageCount: 1, rows: [] });
  });

  it("doesn't make an empty page at an exact multiple", () => {
    expect(paginate(items.slice(0, 20), 1).pageCount).toBe(2);
  });
});

describe("rowsToCsv", () => {
  it("writes a header, then the rows in the order given", () => {
    const csv = rowsToCsv(toRows([expense({ id: "a" }), expense({ id: "b", description: "Taxi" })], "alice"));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      '"Date","Time","Expense","Category","Group","Paid By","Amount (EUR)","Your Share (EUR)"'
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Dinner","Food","Trip","Bob",30.00,-10.00');
    expect(lines[2]).toContain('"Taxi"');
  });

  it("writes You for the viewer's own expenses", () => {
    const [, line] = rowsToCsv(toRows([expense({ paidByUserId: "alice", paidByUserName: "Alice" })], "alice")).split(
      "\r\n"
    );
    expect(line).toContain('"You",30.00,20.00');
  });

  it("escapes quotes and stops text running as a formula", () => {
    const csv = rowsToCsv(toRows([expense({ description: '=HYPERLINK("x")' })], "alice"));
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe("slugify", () => {
  it("makes a file-safe name", () => {
    expect(slugify("Weekend Trip / 2026!")).toBe("weekend-trip-2026");
  });
});

describe("rowsToCsv dates", () => {
  beforeAll(() => {
    vi.stubEnv("TZ", "Europe/Berlin");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("uses the local date, so it matches the time beside it and the table", () => {
    const lateAtNight = expense({ createdAt: "2026-03-04T23:30:00.000Z" });
    const [, line] = rowsToCsv(toRows([lateAtNight], "alice")).split("\r\n");
    expect(line.startsWith('"2026-03-05","00:30",')).toBe(true);
  });
});

