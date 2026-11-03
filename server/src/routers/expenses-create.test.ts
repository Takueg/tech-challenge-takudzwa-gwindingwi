import { beforeEach, describe, expect, it } from "vitest";
import { computeNetBalances } from "../lib/balances.js";
import type { Group, User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { makeGroup, makeUser, netOf, resetDb, sumNet } from "../test-utils/fixtures.js";

let alice: User, bob: User, carol: User;
let group: Group;

beforeEach(() => {
  resetDb();
  alice = makeUser("Alice");
  bob = makeUser("Bob");
  carol = makeUser("Carol");
  group = makeGroup("Trip", [alice, bob, carol]);
});

function input(overrides: Partial<{ groupId: string; description: string; amountCents: number; paidByUserId: string }> = {}) {
  return { groupId: group.id, description: "Taxi", amountCents: 3000, paidByUserId: alice.id, ...overrides };
}

describe("expenses.create through the full read side", () => {
  it("creates an expense that shows up in the group's list, balances and totals", async () => {
    const caller = testCaller();

    const expense = await caller.expenses.create(input());
    const detail = await caller.groups.detail({ groupId: group.id, userId: alice.id });

    expect(expense).toMatchObject({ amountCents: 3000, currency: "EUR", paidByUserName: "Alice" });
    expect(detail.expenses.map((e) => e.id)).toEqual([expense.id]);
    expect(netOf(detail.balances, alice)).toBe(2000);
    expect(netOf(detail.balances, bob)).toBe(-1000);
    expect(Object.values(detail.categoryTotals)).toEqual([3000]);
  });

  it("splits leftover cents the same way as expenses.create", async () => {
    const caller = testCaller();

    const quick = await caller.expenses.create(input({ amountCents: 100 }));
    const full = await caller.expenses.create(input({ amountCents: 100 }));

    expect(quick.splits).toEqual(full.splits);
    expect(quick.splits.map((s) => s.amountCents)).toEqual([34, 33, 33]);
  });

  it("categorizes a description the same way as expenses.create", async () => {
    const caller = testCaller();

    const quick = await caller.expenses.create(input({ description: "Dinner" }));
    const full = await caller.expenses.create(input({ description: "Dinner" }));

    expect(quick.category).toBe(full.category);
  });

  it("rejects a payer who isn't a group member", async () => {
    const outsider = makeUser("Outsider");
    await expect(testCaller().expenses.create(input({ paidByUserId: outsider.id }))).rejects.toThrow();
  });

  it("rejects a payer id that doesn't exist", async () => {
    await expect(testCaller().expenses.create(input({ paidByUserId: "ghost" }))).rejects.toThrow();
  });

  it("never unbalances an empty group", async () => {
    const caller = testCaller();
    const empty = makeGroup("Empty", []);

    await caller.expenses.create(input({ groupId: empty.id })).catch(() => undefined);

    expect(sumNet(computeNetBalances(empty.id))).toBe(0);
  });

  it("rejects an unknown group", async () => {
    await expect(testCaller().expenses.create(input({ groupId: "missing" }))).rejects.toThrow(/not found/i);
  });

  it.each([
    ["a zero amount", { amountCents: 0 }],
    ["a negative amount", { amountCents: -100 }],
    ["a fractional amount", { amountCents: 10.5 }],
    ["an empty description", { description: "" }],
    ["a whitespace-only description", { description: "   " }],
  ])("rejects %s", async (_label, override) => {
    await expect(testCaller().expenses.create(input(override))).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
