import { beforeEach, describe, expect, it } from "vitest";
import { db, nextId, type Group, type User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { addExpense, addSettlement, makeUser, netOf, sortedByUser, sumNet } from "../test-utils/fixtures.js";

let group: Group;
let alice: User, bob: User, carol: User;

beforeEach(() => {
  db.users.clear();
  db.groups.clear();
  db.expenses.clear();
  db.settlements.clear();
  db.groupExpenseCache.clear();

  alice = { id: nextId("user"), name: "Alice", email: "alice@test.com", username: "alice", password: "x" };
  bob = { id: nextId("user"), name: "Bob", email: "bob@test.com", username: "bob", password: "x" };
  carol = { id: nextId("user"), name: "Carol", email: "carol@test.com", username: "carol", password: "x" };
  [alice, bob, carol].forEach((u) => db.users.set(u.id, u));

  group = {
    id: nextId("group"),
    name: "Test Group",
    memberIds: [alice.id, bob.id, carol.id],
    createdAt: new Date().toISOString(),
  };
  db.groups.set(group.id, group);
  db.groupExpenseCache.set(group.id, []);
});

describe("expenses.create", () => {
  it("creates an expense split across all group members", async () => {
    const caller = testCaller();
    const expense = await caller.expenses.create({
      groupId: group.id,
      description: "Dinner",
      amountCents: 3000,
      paidByUserId: alice.id,
    });

    expect(expense.splits).toHaveLength(3);
    expect(expense.splits.reduce((sum, s) => sum + s.amountCents, 0)).toBe(3000);
    expect(expense.category).toBeTypeOf("string");
  });

  it("rejects a payer who isn't a group member", async () => {
    const caller = testCaller();
    await expect(
      caller.expenses.create({
        groupId: group.id,
        description: "Dinner",
        amountCents: 3000,
        paidByUserId: "not-a-member",
      })
    ).rejects.toThrow();
  });

  it("handles several expenses being added to a group", async () => {
    const caller = testCaller();
    const descriptions = ["Groceries", "Taxi", "Museum", "Coffee", "Snacks"];

    for (const description of descriptions) {
      await caller.expenses.create({
        groupId: group.id,
        description,
        amountCents: 1000,
        paidByUserId: alice.id,
      });
    }

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses).toHaveLength(descriptions.length);
  });
});

describe("expenses.delete", () => {
  it("removes the expense from the group's expense list", async () => {
    const caller = testCaller();
    const expense = await caller.expenses.create({
      groupId: group.id,
      description: "Dinner",
      amountCents: 3000,
      paidByUserId: alice.id,
    });

    await caller.expenses.delete({ expenseId: expense.id });

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses.find((e) => e.id === expense.id)).toBeUndefined();
  });

  it("rejects deleting an expense that doesn't exist", async () => {
    const caller = testCaller();
    await expect(caller.expenses.delete({ expenseId: "nonexistent" })).rejects.toThrow();
  });
});

function createInput(overrides: Partial<{ description: string; amountCents: number; paidByUserId: string }> = {}) {
  return { groupId: group.id, description: "Dinner", amountCents: 3000, paidByUserId: alice.id, ...overrides };
}

describe("expenses.create, details", () => {
  it("assigns leftover cents to the first members so the splits still add up", async () => {
    const expense = await testCaller().expenses.create(createInput({ amountCents: 100 }));

    expect(expense.splits).toEqual([
      { userId: alice.id, amountCents: 34 },
      { userId: bob.id, amountCents: 33 },
      { userId: carol.id, amountCents: 33 },
    ]);
  });

  it("records payer, currency, category and timestamps", async () => {
    const expense = await testCaller().expenses.create(createInput({ paidByUserId: bob.id }));

    expect(expense).toMatchObject({
      paidByUserId: bob.id,
      paidByUserName: "Bob",
      currency: "EUR",
      category: "Food",
      status: "active",
    });
    expect(expense.updatedAt).toBe(expense.createdAt);
  });

  it("moves balances by exactly the expense amount", async () => {
    const caller = testCaller();
    await caller.expenses.create(createInput({ amountCents: 100, paidByUserId: carol.id }));

    const { balances } = await caller.groups.detail({ groupId: group.id });

    expect(netOf(balances, alice)).toBe(-34);
    expect(netOf(balances, bob)).toBe(-33);
    expect(netOf(balances, carol)).toBe(67);
  });

  it("keeps later membership changes away from an existing expense's splits", async () => {
    const caller = testCaller();
    const dave = makeUser("Dave");
    const expense = await caller.expenses.create(createInput());

    await caller.groups.addMember({ groupId: group.id, userId: dave.id });
    addSettlement(group, carol, alice, 1000);
    await caller.groups.removeMember({ groupId: group.id, userId: carol.id });

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses.find((e) => e.id === expense.id)?.splits.map((s) => s.userId)).toEqual([
      alice.id,
      bob.id,
      carol.id,
    ]);
    expect(netOf(detail.balances, dave)).toBe(0);
  });

  it("keeps every expense when several are created at the same time", async () => {
    const caller = testCaller();

    await Promise.all(
      [1000, 2000, 3000, 4000, 5000].map((amountCents) => caller.expenses.create(createInput({ amountCents })))
    );

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses).toHaveLength(5);
    expect(detail.expenses.reduce((sum, e) => sum + e.amountCents, 0)).toBe(15000);
    expect(Object.values(detail.categoryTotals).reduce((sum, c) => sum + c, 0)).toBe(15000);
  });

  it("rejects an unknown group", async () => {
    await expect(testCaller().expenses.create({ ...createInput(), groupId: "missing" })).rejects.toThrow(/not found/i);
  });

  it("rejects an amount too large to add up safely", async () => {
    await expect(
      testCaller().expenses.create(createInput({ amountCents: Number.MAX_SAFE_INTEGER + 1 }))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each([
    ["a zero amount", { amountCents: 0 }],
    ["a negative amount", { amountCents: -100 }],
    ["a fractional amount", { amountCents: 10.5 }],
    ["an empty description", { description: "" }],
    ["a whitespace-only description", { description: "   " }],
  ])("rejects %s", async (_label, override) => {
    await expect(testCaller().expenses.create(createInput(override))).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("expenses.update", () => {
  it("changes description, amount and updatedAt, and keeps createdAt", async () => {
    const expense = addExpense(group, alice, 3000, {
      description: "Old",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const updated = await testCaller().expenses.update({ expenseId: expense.id, description: "New", amountCents: 4000 });

    expect(updated).toMatchObject({ description: "New", amountCents: 4000, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(updated.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("recomputes splits so they add up to the new amount", async () => {
    const expense = addExpense(group, alice, 3000);

    const updated = await testCaller().expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 6000 });

    expect(updated.splits.map((s) => s.amountCents)).toEqual([2000, 2000, 2000]);
  });

  it("moves balances to match the new amount when raised", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);

    await caller.expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 6000 });

    const { balances } = await caller.groups.detail({ groupId: group.id });
    expect(netOf(balances, alice)).toBe(4000);
    expect(netOf(balances, bob)).toBe(-2000);
    expect(netOf(balances, carol)).toBe(-2000);
  });

  it("moves balances to match the new amount when lowered", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);

    await caller.expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 300 });

    const { balances } = await caller.groups.detail({ groupId: group.id });
    expect(sumNet(balances)).toBe(0);
    expect(netOf(balances, alice)).toBe(200);
    expect(netOf(balances, bob)).toBe(-100);
  });

  it("splits an edited amount across the people on the original expense, not current members", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    addSettlement(group, carol, alice, 1000);
    await caller.groups.removeMember({ groupId: group.id, userId: carol.id });

    const updated = await caller.expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 6000 });

    expect(updated.splits).toEqual([
      { userId: alice.id, amountCents: 2000 },
      { userId: bob.id, amountCents: 2000 },
      { userId: carol.id, amountCents: 2000 },
    ]);
  });

  it("leaves balances alone when only the description changes", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    const before = (await caller.groups.detail({ groupId: group.id })).balances;

    await caller.expenses.update({ expenseId: expense.id, description: "Renamed", amountCents: 3000 });

    expect((await caller.groups.detail({ groupId: group.id })).balances).toEqual(before);
  });

  it("re-detects the category when the description changes", async () => {
    const expense = await testCaller().expenses.create(createInput({ description: "Dinner" }));

    const updated = await testCaller().expenses.update({
      expenseId: expense.id,
      description: "Flight to Rome",
      amountCents: 3000,
    });

    expect(updated.category).toBe("Travel");
  });

  it("carries the new amount into every total", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000, { category: "Food" });

    await caller.expenses.update({ expenseId: expense.id, description: expense.description, amountCents: 4500 });

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses[0].amountCents).toBe(4500);
    expect(detail.categoryTotals).toEqual({ Food: 4500 });
    expect((await caller.groups.list())[0].totalCents).toBe(4500);
    expect((await caller.stats.overview()).totalCents).toBe(4500);
    expect((await caller.stats.leaderboard())[0].totalCents).toBe(4500);
  });

  it("rejects an unknown expense", async () => {
    await expect(
      testCaller().expenses.update({ expenseId: "missing", description: "Edit", amountCents: 100 })
    ).rejects.toThrow(/not found/i);
  });

  it.each([
    ["a zero amount", { description: "Edit", amountCents: 0 }],
    ["a negative amount", { description: "Edit", amountCents: -100 }],
    ["a fractional amount", { description: "Edit", amountCents: 10.5 }],
    ["an empty description", { description: "", amountCents: 100 }],
  ])("rejects %s and leaves the expense untouched", async (_label, input) => {
    const expense = addExpense(group, alice, 3000, { description: "Original" });

    await expect(testCaller().expenses.update({ expenseId: expense.id, ...input })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(db.expenses.get(expense.id)).toMatchObject({ description: "Original", amountCents: 3000 });
  });
});

describe("expenses.delete, effect on money", () => {
  it("reverses the balances and every total", async () => {
    const caller = testCaller();
    const kept = addExpense(group, bob, 1500, { category: "Food" });
    const deleted = addExpense(group, alice, 3000, { category: "Travel" });

    await caller.expenses.delete({ expenseId: deleted.id });

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(netOf(detail.balances, alice)).toBe(-500);
    expect(netOf(detail.balances, bob)).toBe(1000);
    expect(netOf(detail.balances, carol)).toBe(-500);
    expect(detail.categoryTotals).toEqual({ Food: 1500 });
    expect(detail.expenses.map((e) => e.id)).toEqual([kept.id]);
    expect((await caller.groups.list())[0]).toMatchObject({ expenseCount: 1, totalCents: 1500 });
    expect((await caller.stats.overview()).totalCents).toBe(1500);
  });
});

describe("expenses.uploadReceipt", () => {
  it("stores the receipt without touching the money", async () => {
    const expense = addExpense(group, alice, 3000);

    const updated = await testCaller().expenses.uploadReceipt({
      expenseId: expense.id,
      receiptUrl: "data:image/png;base64,AAA",
    });

    expect(updated.receiptUrl).toBe("data:image/png;base64,AAA");
    expect(updated.amountCents).toBe(3000);
  });

  it("makes the receipt visible on the group's expense list", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);

    await caller.expenses.uploadReceipt({ expenseId: expense.id, receiptUrl: "data:image/png;base64,AAA" });

    expect((await caller.groups.detail({ groupId: group.id })).expenses[0].receiptUrl).toBe("data:image/png;base64,AAA");
  });

  it("rejects an unknown expense", async () => {
    await expect(testCaller().expenses.uploadReceipt({ expenseId: "missing", receiptUrl: "x" })).rejects.toThrow(
      /not found/i
    );
  });
});

describe("expenses.search", () => {
  it("matches descriptions ignoring case and surrounding spaces, newest first", async () => {
    const older = addExpense(group, alice, 100, { description: "Team DINNER", createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = addExpense(group, alice, 100, { description: "dinner out", createdAt: "2026-02-01T00:00:00.000Z" });
    addExpense(group, alice, 100, { description: "Taxi" });

    const results = await testCaller().expenses.search({ query: "  Dinner " });

    expect(results.map((e) => e.id)).toEqual([newer.id, older.id]);
  });

  it("returns nothing for a blank query", async () => {
    addExpense(group, alice, 100);
    expect(await testCaller().expenses.search({ query: "   " })).toEqual([]);
  });

  it("stops returning a deleted expense", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 100, { description: "Dinner" });

    await caller.expenses.delete({ expenseId: expense.id });

    expect(await caller.expenses.search({ query: "dinner" })).toEqual([]);
  });

  it("stops returning expenses from a deleted group", async () => {
    const caller = testCaller();
    addExpense(group, alice, 100, { description: "Dinner" });

    await caller.groups.delete({ groupId: group.id });

    expect(await caller.expenses.search({ query: "dinner" })).toEqual([]);
  });
});

describe("expenses.previewSplit", () => {
  it.each([3000, 100, 101, 1])("matches the splits expenses.create produces for %i cents", async (amountCents) => {
    const caller = testCaller();

    const preview = await caller.expenses.previewSplit({ groupId: group.id, amountCents });
    const expense = await caller.expenses.create(createInput({ amountCents }));

    expect(preview).toEqual(expense.splits);
  });

  it("adds up to the amount", async () => {
    const preview = await testCaller().expenses.previewSplit({ groupId: group.id, amountCents: 101 });
    expect(preview.reduce((sum, s) => sum + s.amountCents, 0)).toBe(101);
  });

  it("rejects an unknown group", async () => {
    await expect(testCaller().expenses.previewSplit({ groupId: "missing", amountCents: 100 })).rejects.toThrow(
      /not found/i
    );
  });

  it("rejects a non-positive amount", async () => {
    await expect(testCaller().expenses.previewSplit({ groupId: group.id, amountCents: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("expenses.previewBalances", () => {
  it.each([3000, 100, 200, 101, 1])(
    "matches the real balances after creating an expense of %i cents",
    async (amountCents) => {
      const caller = testCaller();
      addExpense(group, bob, 1000);

      const preview = await caller.expenses.previewBalances({
        groupId: group.id,
        amountCents,
        paidByUserId: carol.id,
      });
      await caller.expenses.create(createInput({ amountCents, paidByUserId: carol.id }));
      const detail = await caller.groups.detail({ groupId: group.id });

      expect(sortedByUser(preview.balances)).toEqual(sortedByUser(detail.balances));
      expect(preview.suggestedTransfers).toEqual(detail.suggestedTransfers);
    }
  );

  it("nets to zero for an amount that doesn't divide evenly", async () => {
    const preview = await testCaller().expenses.previewBalances({
      groupId: group.id,
      amountCents: 100,
      paidByUserId: alice.id,
    });

    expect(sumNet(preview.balances)).toBe(0);
  });

  it("does not change anything", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000);
    const before = await caller.groups.detail({ groupId: group.id });

    await caller.expenses.previewBalances({ groupId: group.id, amountCents: 5000, paidByUserId: bob.id });

    expect(await caller.groups.detail({ groupId: group.id })).toEqual(before);
  });

  it("rejects a payer who isn't a group member", async () => {
    await expect(
      testCaller().expenses.previewBalances({ groupId: group.id, amountCents: 100, paidByUserId: "not-a-member" })
    ).rejects.toThrow();
  });

  it("rejects an unknown group", async () => {
    await expect(
      testCaller().expenses.previewBalances({ groupId: "missing", amountCents: 100, paidByUserId: alice.id })
    ).rejects.toThrow(/not found/i);
  });
});
