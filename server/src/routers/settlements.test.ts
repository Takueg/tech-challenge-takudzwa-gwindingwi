import { beforeEach, describe, expect, it } from "vitest";
import { db, type Group, type User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { addExpense, makeGroup, makeUser, netOf, resetDb, sumNet } from "../test-utils/fixtures.js";

let alice: User, bob: User, carol: User;
let group: Group;

beforeEach(() => {
  resetDb();
  alice = makeUser("Alice");
  bob = makeUser("Bob");
  carol = makeUser("Carol");
  group = makeGroup("Trip", [alice, bob, carol]);
});

describe("settlements.create", () => {
  it("records the settlement", async () => {
    const settlement = await testCaller().settlements.create({
      groupId: group.id,
      fromUserId: bob.id,
      toUserId: alice.id,
      amountCents: 1000,
    });

    expect(settlement).toMatchObject({ groupId: group.id, fromUserId: bob.id, toUserId: alice.id, amountCents: 1000 });
    expect(db.settlements.get(settlement.id)).toEqual(settlement);
  });

  it("reduces what the payer owes and what the receiver is owed", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000);

    await caller.settlements.create({ groupId: group.id, fromUserId: bob.id, toUserId: alice.id, amountCents: 400 });

    const { balances } = await caller.groups.detail({ groupId: group.id });
    expect(netOf(balances, alice)).toBe(1600);
    expect(netOf(balances, bob)).toBe(-600);
    expect(netOf(balances, carol)).toBe(-1000);
    expect(sumNet(balances)).toBe(0);
  });

  it("clears the group when every suggested transfer is paid", async () => {
    const caller = testCaller();
    addExpense(group, alice, 10000);
    addExpense(group, bob, 3333);
    addExpense(group, carol, 1);

    const { suggestedTransfers } = await caller.groups.detail({ groupId: group.id });
    expect(suggestedTransfers.length).toBeGreaterThan(0);
    for (const transfer of suggestedTransfers) {
      await caller.settlements.create({ groupId: group.id, ...transfer });
    }

    const after = await caller.groups.detail({ groupId: group.id });
    expect(after.balances.every((b) => b.netCents === 0)).toBe(true);
    expect(after.suggestedTransfers).toEqual([]);
  });

  it("does not change group spending totals", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000, { category: "Food" });

    await caller.settlements.create({ groupId: group.id, fromUserId: bob.id, toUserId: alice.id, amountCents: 1000 });

    expect((await caller.groups.detail({ groupId: group.id })).categoryTotals).toEqual({ Food: 3000 });
    expect((await caller.stats.overview()).totalCents).toBe(3000);
  });

  it("rejects an unknown group", async () => {
    await expect(
      testCaller().settlements.create({ groupId: "missing", fromUserId: bob.id, toUserId: alice.id, amountCents: 100 })
    ).rejects.toThrow(/not found/i);
  });

  it("lets a former member settle a balance they still carry", async () => {
    const caller = testCaller();
    const expense = addExpense(group, alice, 3000);
    await caller.settlements.create({ groupId: group.id, fromUserId: carol.id, toUserId: alice.id, amountCents: 1000 });
    await caller.groups.removeMember({ groupId: group.id, userId: carol.id });
    await caller.expenses.update({ expenseId: expense.id, description: expense.description, amountCents: 6000 });

    await caller.settlements.create({ groupId: group.id, fromUserId: carol.id, toUserId: alice.id, amountCents: 1000 });

    const { balances } = await caller.groups.detail({ groupId: group.id });
    expect(netOf(balances, carol)).toBeUndefined();
    expect(sumNet(balances)).toBe(0);
  });

  it("rejects paying yourself", async () => {
    await expect(
      testCaller().settlements.create({ groupId: group.id, fromUserId: bob.id, toUserId: bob.id, amountCents: 100 })
    ).rejects.toThrow();
  });

  it("rejects a payer outside the group", async () => {
    const outsider = makeUser("Outsider");
    await expect(
      testCaller().settlements.create({
        groupId: group.id,
        fromUserId: outsider.id,
        toUserId: alice.id,
        amountCents: 100,
      })
    ).rejects.toThrow();
  });

  it("rejects a receiver outside the group", async () => {
    const outsider = makeUser("Outsider");
    await expect(
      testCaller().settlements.create({
        groupId: group.id,
        fromUserId: alice.id,
        toUserId: outsider.id,
        amountCents: 100,
      })
    ).rejects.toThrow();
  });

  it.each([
    ["zero", 0],
    ["negative", -100],
    ["fractional", 10.5],
  ])("rejects a %s amount", async (_label, amountCents) => {
    await expect(
      testCaller().settlements.create({ groupId: group.id, fromUserId: bob.id, toUserId: alice.id, amountCents })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
