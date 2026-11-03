import { beforeEach, describe, expect, it } from "vitest";
import { db, nextId, type Group, type User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { addExpense, addSettlement, makeGroup, makeUser, netOf, settleUp, sortedByUser, sumNet } from "../test-utils/fixtures.js";

let group: Group;
let alice: User, bob: User, carol: User;

beforeEach(() => {
  db.users.clear();
  db.groups.clear();
  db.expenses.clear();
  db.settlements.clear();

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

    await caller.expenses.delete({ expenseId: expense.id, userId: alice.id });

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses.find((e) => e.id === expense.id)).toBeUndefined();
  });

  it("rejects deleting an expense that doesn't exist", async () => {
    const caller = testCaller();
    await expect(caller.expenses.delete({ expenseId: "nonexistent", userId: alice.id })).rejects.toThrow();
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

    await caller.groups.addMembers({ groupId: group.id, userIds: [dave.id] });
    addSettlement(group, carol, alice, 1000);
    await caller.groups.removeMembers({ groupId: group.id, userIds: [carol.id] });

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

    const updated = await testCaller().expenses.update({ expenseId: expense.id, description: "New", amountCents: 4000, userId: alice.id });

    expect(updated).toMatchObject({ description: "New", amountCents: 4000, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(updated.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("recomputes splits so they add up to the new amount", async () => {
    const expense = addExpense(group, alice, 3000);

    const updated = await testCaller().expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 6000, userId: alice.id });

    expect(updated.splits.map((s) => s.amountCents)).toEqual([2000, 2000, 2000]);
  });

  it("moves balances to match the new amount when raised", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);

    await caller.expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 6000, userId: alice.id });

    const { balances } = await caller.groups.detail({ groupId: group.id });
    expect(netOf(balances, alice)).toBe(4000);
    expect(netOf(balances, bob)).toBe(-2000);
    expect(netOf(balances, carol)).toBe(-2000);
  });

  it("moves balances to match the new amount when lowered", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);

    await caller.expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 300, userId: alice.id });

    const { balances } = await caller.groups.detail({ groupId: group.id });
    expect(sumNet(balances)).toBe(0);
    expect(netOf(balances, alice)).toBe(200);
    expect(netOf(balances, bob)).toBe(-100);
  });

  it("splits an edited amount across the people on the original expense, not current members", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    addSettlement(group, carol, alice, 1000);
    await caller.groups.removeMembers({ groupId: group.id, userIds: [carol.id] });

    const updated = await caller.expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 6000, userId: alice.id });

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

    await caller.expenses.update({ expenseId: expense.id, description: "Renamed", amountCents: 3000, userId: alice.id });

    expect((await caller.groups.detail({ groupId: group.id })).balances).toEqual(before);
  });

  it("re-detects the category when the description changes", async () => {
    const expense = await testCaller().expenses.create(createInput({ description: "Dinner" }));

    const updated = await testCaller().expenses.update({
      userId: alice.id,
      expenseId: expense.id,
      description: "Flight to Rome",
      amountCents: 3000,
    });

    expect(updated.category).toBe("Travel");
  });

  it("carries the new amount into every total", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000, { category: "Food" });

    await caller.expenses.update({ expenseId: expense.id, description: expense.description, amountCents: 4500, userId: alice.id });

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses[0].amountCents).toBe(4500);
    expect(detail.categoryTotals).toEqual({ Food: 4500 });
    expect((await caller.groups.list())[0].totalCents).toBe(4500);
    expect((await caller.stats.overview()).totalCents).toBe(4500);
    expect((await caller.stats.leaderboard())[0].totalCents).toBe(4500);
  });

  it("rejects an unknown expense", async () => {
    await expect(
      testCaller().expenses.update({ expenseId: "missing", description: "Edit", amountCents: 100, userId: alice.id })
    ).rejects.toThrow(/not found/i);
  });

  it.each([
    ["a zero amount", { description: "Edit", amountCents: 0 }],
    ["a negative amount", { description: "Edit", amountCents: -100 }],
    ["a fractional amount", { description: "Edit", amountCents: 10.5 }],
    ["an empty description", { description: "", amountCents: 100 }],
  ])("rejects %s and leaves the expense untouched", async (_label, input) => {
    const expense = addExpense(group, alice, 3000, { description: "Original" });

    await expect(testCaller().expenses.update({ expenseId: expense.id, ...input, userId: alice.id })).rejects.toMatchObject({
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

    await caller.expenses.delete({ expenseId: deleted.id, userId: alice.id });

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

describe("expenses in an archived group", () => {
  it("are left out of search until the group is unarchived", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 100, { description: "Dinner" });
    settleUp(group);

    await caller.groups.archive({ groupId: group.id });
    expect(await caller.expenses.list({})).toEqual([]);

    await caller.groups.unarchive({ groupId: group.id });
    expect((await caller.expenses.list({})).map((e) => e.id)).toEqual([expense.id]);
  });

  it("can't be edited, deleted or given a receipt", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000, { description: "Dinner" });
    settleUp(group);
    await caller.groups.archive({ groupId: group.id });

    await expect(
      caller.expenses.update({ expenseId: expense.id, description: "Edit", amountCents: 100, userId: alice.id })
    ).rejects.toThrow(/archived/i);
    await expect(caller.expenses.delete({ expenseId: expense.id, userId: alice.id })).rejects.toThrow(/archived/i);

    expect(db.expenses.get(expense.id)).toMatchObject({ description: "Dinner", amountCents: 3000 });
  });

  it("can be edited again once unarchived", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    settleUp(group);
    await caller.groups.archive({ groupId: group.id });
    await caller.groups.unarchive({ groupId: group.id });

    const updated = await caller.expenses.update({
      userId: alice.id,
      expenseId: expense.id,
      description: expense.description,
      amountCents: 6000,
    });

    expect(updated.amountCents).toBe(6000);
  });

  it("can't be added to with expenses.create", async () => {
    const caller = testCaller();
    await caller.groups.archive({ groupId: group.id });

    await expect(caller.expenses.create(createInput())).rejects.toThrow(/archived/i);
    expect(db.expenses.size).toBe(0);
  });

  it("can be added to again once unarchived, without inheriting the archived state", async () => {
    const caller = testCaller();
    await caller.groups.archive({ groupId: group.id });
    await caller.groups.unarchive({ groupId: group.id });

    await caller.expenses.create(createInput());

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses.map((e) => e.archivedAt)).toEqual([undefined]);
  });
});

describe("expenses.list", () => {
  it("lists across groups, newest first, with the group name", async () => {
    const flat = makeGroup("Flat", [alice, bob]);
    const older = addExpense(group, alice, 1000, { createdAt: "2026-01-01T10:00:00.000Z" });
    const newer = addExpense(flat, bob, 2000, { createdAt: "2026-02-01T10:00:00.000Z" });

    const rows = await testCaller().expenses.list({});

    expect(rows.map((e) => [e.id, e.groupName])).toEqual([
      [newer.id, "Flat"],
      [older.id, group.name],
    ]);
  });

  it("filters to one group", async () => {
    const flat = makeGroup("Flat", [alice, bob]);
    addExpense(flat, bob, 2000);
    const mine = addExpense(group, alice, 1000);

    const rows = await testCaller().expenses.list({ groupId: group.id });
    expect(rows.map((e) => e.id)).toEqual([mine.id]);
  });

  it("leaves out archived groups unless one is asked for", async () => {
    const caller = testCaller();
    const flat = makeGroup("Flat", [alice, bob]);
    const archived = addExpense(flat, bob, 2000);
    settleUp(flat);
    await caller.groups.archive({ groupId: flat.id });

    expect(await caller.expenses.list({})).toEqual([]);
    expect((await caller.expenses.list({ groupId: flat.id })).map((e) => e.id)).toEqual([archived.id]);
  });

  it("rejects a group that doesn't exist", async () => {
    await expect(testCaller().expenses.list({ groupId: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("caps how many rows it returns", async () => {
    for (let i = 0; i < 1001; i += 1) addExpense(group, alice, 100);

    expect(await testCaller().expenses.list({})).toHaveLength(1000);
  });
});

describe("expenses.detectCategory", () => {
  it("returns the category an expense with this description would get", async () => {
    expect(await testCaller().expenses.detectCategory({ description: "Team dinner" })).toBe("Food");
    expect(await testCaller().expenses.detectCategory({ description: "Rent - May" })).toBe("Rent");
  });

  it("rejects a blank description", async () => {
    await expect(testCaller().expenses.detectCategory({ description: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("expenses.update payer", () => {
  it("moves the expense to the new payer and shifts balances", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);

    const updated = await caller.expenses.update({
      userId: alice.id,
      expenseId: expense.id,
      description: expense.description,
      amountCents: 3000,
      paidByUserId: bob.id,
    });

    expect(updated).toMatchObject({ paidByUserId: bob.id, paidByUserName: "Bob" });
    const { balances } = await caller.groups.detail({ groupId: group.id });
    expect(balances.find((b) => b.userId === bob.id)?.netCents).toBeGreaterThan(0);
    expect(balances.find((b) => b.userId === alice.id)?.netCents).toBeLessThan(0);
  });

  it("keeps the payer when none is passed", async () => {
    const expense = addExpense(group, alice, 3000);

    const updated = await testCaller().expenses.update({
      userId: alice.id,
      expenseId: expense.id,
      description: "Renamed",
      amountCents: 3000,
    });

    expect(updated.paidByUserId).toBe(alice.id);
  });

  it("rejects a payer who isn't in the group", async () => {
    const outsider = makeUser("Outsider");
    const expense = addExpense(group, alice, 3000);

    await expect(
      testCaller().expenses.update({
        userId: alice.id,
        expenseId: expense.id,
        description: expense.description,
        amountCents: 3000,
        paidByUserId: outsider.id,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.expenses.get(expense.id)?.paidByUserId).toBe(alice.id);
  });
});

describe("expenses.restore", () => {
  it("brings back a deleted expense and its effect on balances", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    const before = await caller.groups.detail({ groupId: group.id });
    await caller.expenses.delete({ expenseId: expense.id, userId: alice.id });

    await caller.expenses.restore({ expenseId: expense.id, userId: alice.id });

    const after = await caller.groups.detail({ groupId: group.id });
    expect(after.expenses.map((e) => e.id)).toEqual([expense.id]);
    expect(after.balances).toEqual(before.balances);
  });

  it("can't restore twice", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    await caller.expenses.delete({ expenseId: expense.id, userId: alice.id });
    await caller.expenses.restore({ expenseId: expense.id, userId: alice.id });

    await expect(caller.expenses.restore({ expenseId: expense.id, userId: alice.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses in an archived group", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    await caller.expenses.delete({ expenseId: expense.id, userId: alice.id });
    settleUp(group);
    await caller.groups.archive({ groupId: group.id });

    await expect(caller.expenses.restore({ expenseId: expense.id, userId: alice.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("is gone once its group is deleted", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    await caller.expenses.delete({ expenseId: expense.id, userId: alice.id });
    await caller.groups.delete({ groupId: group.id });

    await expect(caller.expenses.restore({ expenseId: expense.id, userId: alice.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("expenses.previewSplit for an existing expense", () => {
  it("splits across the people on the expense, not today's members", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    const dave = makeUser("Dave");
    group.memberIds.push(dave.id);

    const preview = await caller.expenses.previewSplit({ groupId: group.id, amountCents: 4000, expenseId: expense.id });
    const saved = await caller.expenses.update({ expenseId: expense.id, description: "x", amountCents: 4000, userId: alice.id });

    expect(preview).toEqual(saved.splits);
    expect(preview.map((s) => s.userId)).not.toContain(dave.id);
  });

  it("still splits across today's members without an expense", async () => {
    const dave = makeUser("Dave");
    group.memberIds.push(dave.id);

    const preview = await testCaller().expenses.previewSplit({ groupId: group.id, amountCents: 4000 });
    expect(preview.map((s) => s.userId)).toContain(dave.id);
  });

  it("rejects an expense from another group", async () => {
    const other = makeGroup("Other", [alice, bob]);
    const expense = addExpense(other, alice, 3000);

    await expect(
      testCaller().expenses.previewSplit({ groupId: group.id, amountCents: 4000, expenseId: expense.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

