import { beforeEach, describe, expect, it } from "vitest";
import { db, type Group, type User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { addExpense, addSettlement, makeGroup, makeUser, netOf, resetDb, settleUp, sumNet } from "../test-utils/fixtures.js";

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
    addExpense(group, alice, 3000);

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

  it("rejects a settlement in an archived group, since it would create a new debt", async () => {
    const caller = testCaller();
    await caller.groups.archive({ groupId: group.id });

    await expect(
      caller.settlements.create({ groupId: group.id, fromUserId: bob.id, toUserId: alice.id, amountCents: 100 })
    ).rejects.toThrow(/archived/i);
    expect(db.settlements.size).toBe(0);
  });

  it("accepts paying exactly what's owed", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000);

    await caller.settlements.create({ groupId: group.id, fromUserId: bob.id, toUserId: alice.id, amountCents: 1000 });

    expect(netOf((await caller.groups.detail({ groupId: group.id })).balances, bob)).toBe(0);
  });

  it("rejects paying more than the payer owes", async () => {
    addExpense(group, alice, 3000);

    await expect(
      testCaller().settlements.create({ groupId: group.id, fromUserId: bob.id, toUserId: alice.id, amountCents: 1001 })
    ).rejects.toThrow(/more than/i);
    expect(db.settlements.size).toBe(0);
  });

  it("rejects paying more than the receiver is owed", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000);
    addExpense(group, bob, 3300);

    // Carol owes 2100 but Bob is only owed 1200, so the receiver sets the limit here.
    await expect(
      caller.settlements.create({ groupId: group.id, fromUserId: carol.id, toUserId: bob.id, amountCents: 1201 })
    ).rejects.toThrow(/more than/i);
    expect(db.settlements.size).toBe(0);
  });

  it("rejects recording the same payment twice", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000);
    const payment = { groupId: group.id, fromUserId: bob.id, toUserId: alice.id, amountCents: 1000 };

    await caller.settlements.create(payment);

    await expect(caller.settlements.create(payment)).rejects.toThrow();
    expect(netOf((await caller.groups.detail({ groupId: group.id })).balances, bob)).toBe(0);
  });

  it("rejects a payer who doesn't owe anything", async () => {
    addExpense(group, alice, 3000);

    await expect(
      testCaller().settlements.create({ groupId: group.id, fromUserId: alice.id, toUserId: bob.id, amountCents: 100 })
    ).rejects.toThrow();
  });

  it("rejects a receiver who isn't owed anything", async () => {
    addExpense(group, alice, 3000);

    await expect(
      testCaller().settlements.create({ groupId: group.id, fromUserId: bob.id, toUserId: carol.id, amountCents: 100 })
    ).rejects.toThrow();
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

describe("settlements.delete", () => {
  it("undoes the settlement and restores the debt", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000);
    const settlement = await caller.settlements.create({
      groupId: group.id,
      fromUserId: bob.id,
      toUserId: alice.id,
      amountCents: 1000,
    });

    await expect(caller.settlements.delete({ settlementId: settlement.id })).resolves.toEqual({ ok: true });

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.settlements).toEqual([]);
    expect(netOf(detail.balances, bob)).toBe(-1000);
    expect(netOf(detail.balances, alice)).toBe(2000);
  });

  it("rejects an unknown settlement", async () => {
    await expect(testCaller().settlements.delete({ settlementId: "missing" })).rejects.toThrow(/not found/i);
  });

  it("rejects undoing a settlement in an archived group", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000);
    settleUp(group);
    const [settlement] = Array.from(db.settlements.values());
    await caller.groups.archive({ groupId: group.id });

    await expect(caller.settlements.delete({ settlementId: settlement.id })).rejects.toThrow(/archived/i);
    expect(db.settlements.has(settlement.id)).toBe(true);
  });
});

describe("settlements.suggestedForUser", () => {
  it("lists only the debts involving the user, across groups, with names", async () => {
    const dave = makeUser("Dave");
    const first = makeGroup("First", [alice, bob]);
    const second = makeGroup("Second", [alice, dave]);
    const unrelated = makeGroup("Unrelated", [bob, dave]);
    addExpense(first, alice, 1000);
    addExpense(second, dave, 3000);
    addExpense(unrelated, bob, 500);

    expect(await testCaller().settlements.suggestedForUser({ userId: alice.id })).toEqual([
      {
        groupId: first.id,
        groupName: "First",
        fromUserId: bob.id,
        fromName: "Bob",
        toUserId: alice.id,
        toName: "Alice",
        amountCents: 500,
      },
      {
        groupId: second.id,
        groupName: "Second",
        fromUserId: alice.id,
        fromName: "Alice",
        toUserId: dave.id,
        toName: "Dave",
        amountCents: 1500,
      },
    ]);
  });

  it("leaves out archived groups", async () => {
    const caller = testCaller();
    const settled = makeGroup("Settled", [alice, bob]);
    await caller.groups.archive({ groupId: settled.id });

    const rows = await caller.settlements.suggestedForUser({ userId: alice.id });
    expect(rows.filter((r) => r.groupId === settled.id)).toEqual([]);
  });
});

describe("settlements.restore", () => {
  it("puts a deleted settlement back on the balances", async () => {
    const caller = testCaller();
    const restoring = makeGroup("Restoring", [alice, bob]);
    addExpense(restoring, alice, 1000);
    const settlement = addSettlement(restoring, bob, alice, 500);
    await caller.settlements.delete({ settlementId: settlement.id });

    await caller.settlements.restore({ settlementId: settlement.id });

    const detail = await caller.groups.detail({ groupId: restoring.id });
    expect(detail.settlements.map((s) => s.id)).toEqual([settlement.id]);
    expect(netOf(detail.balances, alice)).toBe(0);
  });

  it("can't restore something that was never deleted", async () => {
    const restoring = makeGroup("Restoring", [alice, bob]);
    addExpense(restoring, alice, 1000);
    const settlement = addSettlement(restoring, bob, alice, 100);

    await expect(testCaller().settlements.restore({ settlementId: settlement.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses when the debt it paid no longer exists", async () => {
    const caller = testCaller();
    const restoring = makeGroup("Restoring", [alice, bob]);
    const expense = addExpense(restoring, alice, 1000);
    const settlement = addSettlement(restoring, bob, alice, 500);
    await caller.settlements.delete({ settlementId: settlement.id });
    await caller.expenses.delete({ expenseId: expense.id });

    await expect(caller.settlements.restore({ settlementId: settlement.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("refuses in an archived group", async () => {
    const caller = testCaller();
    const restoring = makeGroup("Restoring", [alice, bob]);
    addExpense(restoring, alice, 1000);
    const settlement = addSettlement(restoring, bob, alice, 500);
    await caller.settlements.delete({ settlementId: settlement.id });
    addSettlement(restoring, bob, alice, 500);
    await caller.groups.archive({ groupId: restoring.id });

    await expect(caller.settlements.restore({ settlementId: settlement.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
