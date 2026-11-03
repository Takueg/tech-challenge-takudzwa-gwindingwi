import { beforeEach, describe, expect, it } from "vitest";
import { db, nextId, type Expense, type Group, type User } from "./db.js";
import { computeNetBalances, simplifyDebts } from "./balances.js";
import { EqualSplitStrategy } from "./split-strategies/equal-split-strategy.js";

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
});

function addExpense(paidByUserId: string, amountCents: number, splits: { userId: string; amountCents: number }[]) {
  const expense: Expense = {
    id: nextId("expense"),
    groupId: group.id,
    description: "test expense",
    amountCents,
    currency: "EUR",
    paidByUserId,
    paidByUserName: "Test User",
    splits,
    category: "Other",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.expenses.set(expense.id, expense);
  return expense;
}

describe("computeNetBalances", () => {
  it("handles a simple even split", () => {
    addExpense(alice.id, 6000, [
      { userId: alice.id, amountCents: 2000 },
      { userId: bob.id, amountCents: 2000 },
      { userId: carol.id, amountCents: 2000 },
    ]);

    const balances = computeNetBalances(group.id);

    expect(balances.find((b) => b.userId === alice.id)?.netCents).toBe(4000);
    expect(balances.find((b) => b.userId === bob.id)?.netCents).toBe(-2000);
    expect(balances.find((b) => b.userId === carol.id)?.netCents).toBe(-2000);
  });

  it("reflects multiple expenses and a settlement", () => {
    addExpense(alice.id, 6000, [
      { userId: alice.id, amountCents: 2000 },
      { userId: bob.id, amountCents: 2000 },
      { userId: carol.id, amountCents: 2000 },
    ]);
    addExpense(bob.id, 3000, [
      { userId: alice.id, amountCents: 1000 },
      { userId: bob.id, amountCents: 1000 },
      { userId: carol.id, amountCents: 1000 },
    ]);
    db.settlements.set(nextId("settlement"), {
      id: nextId("settlement"),
      groupId: group.id,
      fromUserId: carol.id,
      toUserId: alice.id,
      amountCents: 500,
      createdAt: new Date().toISOString(),
    });

    const balances = computeNetBalances(group.id);

    // Cross-check against the same accumulation the implementation itself performs.
    const expected = new Map<string, number>();
    for (const id of group.memberIds) expected.set(id, 0);
    for (const expense of db.expenses.values()) {
      if (expense.groupId !== group.id) continue;
      expected.set(expense.paidByUserId, (expected.get(expense.paidByUserId) ?? 0) + expense.amountCents);
      for (const split of expense.splits) {
        expected.set(split.userId, (expected.get(split.userId) ?? 0) - split.amountCents);
      }
    }
    for (const settlement of db.settlements.values()) {
      if (settlement.groupId !== group.id) continue;
      expected.set(settlement.fromUserId, (expected.get(settlement.fromUserId) ?? 0) + settlement.amountCents);
      expected.set(settlement.toUserId, (expected.get(settlement.toUserId) ?? 0) - settlement.amountCents);
    }

    for (const balance of balances) {
      expect(balance.netCents).toBe(expected.get(balance.userId));
    }
  });

  it("returns zero for a group with no activity", () => {
    const balances = computeNetBalances(group.id);
    expect(balances.every((b) => b.netCents === 0)).toBe(true);
  });
});

describe("simplifyDebts", () => {
  it("settles all debt", () => {
    addExpense(alice.id, 9000, [
      { userId: alice.id, amountCents: 3000 },
      { userId: bob.id, amountCents: 3000 },
      { userId: carol.id, amountCents: 3000 },
    ]);

    const balances = computeNetBalances(group.id);
    const transfers = simplifyDebts(balances);
    const totalTransferred = transfers.reduce((sum, t) => sum + t.amountCents, 0);
    const totalOwed = balances.filter((b) => b.netCents < 0).reduce((sum, b) => sum - b.netCents, 0);

    expect(totalTransferred).toBe(totalOwed);
  });

  it("returns no transfers when everyone is settled", () => {
    const balances = computeNetBalances(group.id);
    expect(simplifyDebts(balances)).toEqual([]);
  });
});

describe("computeNetBalances, hand-computed cases", () => {
  function net(user: User): number | undefined {
    return computeNetBalances(group.id).find((b) => b.userId === user.id)?.netCents;
  }

  function evenSplit(amountEach: number) {
    return [alice, bob, carol].map((u) => ({ userId: u.id, amountCents: amountEach }));
  }

  function settle(from: User, to: User, amountCents: number, groupId = group.id) {
    const id = nextId("settlement");
    db.settlements.set(id, {
      id,
      groupId,
      fromUserId: from.id,
      toUserId: to.id,
      amountCents,
      createdAt: new Date().toISOString(),
    });
  }

  it("combines expenses and a settlement into the exact amounts", () => {
    addExpense(alice.id, 6000, evenSplit(2000));
    addExpense(bob.id, 3000, evenSplit(1000));
    settle(carol, alice, 500);

    expect(net(alice)).toBe(2500);
    expect(net(bob)).toBe(0);
    expect(net(carol)).toBe(-2500);
  });

  it("keeps leftover cents on whoever the split assigned them to", () => {
    addExpense(alice.id, 100, [
      { userId: alice.id, amountCents: 34 },
      { userId: bob.id, amountCents: 33 },
      { userId: carol.id, amountCents: 33 },
    ]);

    expect(net(alice)).toBe(66);
    expect(net(bob)).toBe(-33);
    expect(net(carol)).toBe(-33);
  });

  it("credits a payer in full when they aren't part of the split", () => {
    addExpense(alice.id, 1000, [{ userId: bob.id, amountCents: 1000 }]);

    expect(net(alice)).toBe(1000);
    expect(net(bob)).toBe(-1000);
    expect(net(carol)).toBe(0);
  });

  it("nets to zero for a payer who is the only person in the split", () => {
    addExpense(alice.id, 1000, [{ userId: alice.id, amountCents: 1000 }]);

    expect(net(alice)).toBe(0);
  });

  it("moves the payer of a settlement up and the receiver down", () => {
    settle(bob, alice, 700);

    expect(net(bob)).toBe(700);
    expect(net(alice)).toBe(-700);
  });

  it("flips who owes whom when a settlement overpays the debt", () => {
    addExpense(alice.id, 3000, evenSplit(1000));
    settle(bob, alice, 1500);

    expect(net(bob)).toBe(500);
    expect(net(alice)).toBe(500);
    expect(net(carol)).toBe(-1000);
  });

  it("ignores expenses and settlements from other groups", () => {
    const other: Group = { id: nextId("group"), name: "Other", memberIds: [alice.id, bob.id], createdAt: "" };
    db.groups.set(other.id, other);
    const stray = addExpense(alice.id, 5000, [{ userId: bob.id, amountCents: 5000 }]);
    stray.groupId = other.id;
    settle(bob, alice, 100, other.id);

    expect(computeNetBalances(group.id).every((b) => b.netCents === 0)).toBe(true);
  });

  it("returns one entry per member even when some have no activity", () => {
    addExpense(alice.id, 1000, [{ userId: bob.id, amountCents: 1000 }]);

    expect(computeNetBalances(group.id).map((b) => b.userId).sort()).toEqual([alice.id, bob.id, carol.id].sort());
  });

  it("keeps a removed member's balance so the group still nets to zero", () => {
    addExpense(alice.id, 3000, evenSplit(1000));
    group.memberIds = [alice.id, bob.id];

    expect(net(carol)).toBe(-1000);
    expect(computeNetBalances(group.id).reduce((sum, b) => sum + b.netCents, 0)).toBe(0);
  });

  it("throws for an unknown group", () => {
    expect(() => computeNetBalances("missing")).toThrow(/not found/i);
  });
});

describe("simplifyDebts, exact transfers", () => {
  it("has each debtor pay the single creditor", () => {
    expect(
      simplifyDebts([
        { userId: "a", netCents: 3000 },
        { userId: "b", netCents: -1000 },
        { userId: "c", netCents: -2000 },
      ])
    ).toEqual([
      { fromUserId: "c", toUserId: "a", amountCents: 2000 },
      { fromUserId: "b", toUserId: "a", amountCents: 1000 },
    ]);
  });

  it("has a single debtor pay every creditor", () => {
    expect(
      simplifyDebts([
        { userId: "a", netCents: 1000 },
        { userId: "b", netCents: 2000 },
        { userId: "c", netCents: -3000 },
      ])
    ).toEqual([
      { fromUserId: "c", toUserId: "b", amountCents: 2000 },
      { fromUserId: "c", toUserId: "a", amountCents: 1000 },
    ]);
  });

  it("splits one debtor's payment across creditors when needed", () => {
    expect(
      simplifyDebts([
        { userId: "a", netCents: 500 },
        { userId: "b", netCents: 500 },
        { userId: "c", netCents: -700 },
        { userId: "d", netCents: -300 },
      ])
    ).toEqual([
      { fromUserId: "c", toUserId: "a", amountCents: 500 },
      { fromUserId: "c", toUserId: "b", amountCents: 200 },
      { fromUserId: "d", toUserId: "b", amountCents: 300 },
    ]);
  });

  it("leaves out anyone already settled", () => {
    expect(
      simplifyDebts([
        { userId: "a", netCents: 100 },
        { userId: "b", netCents: 0 },
        { userId: "c", netCents: -100 },
      ])
    ).toEqual([{ fromUserId: "c", toUserId: "a", amountCents: 100 }]);
  });

  it("does not mutate the balances it's given", () => {
    const balances = [
      { userId: "a", netCents: 100 },
      { userId: "b", netCents: -100 },
    ];
    simplifyDebts(balances);
    expect(balances).toEqual([
      { userId: "a", netCents: 100 },
      { userId: "b", netCents: -100 },
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(simplifyDebts([])).toEqual([]);
  });
});

describe("balance invariants over a run of mixed expenses", () => {
  const strategy = new EqualSplitStrategy();
  const amounts = [1, 2, 99, 100, 101, 3333, 9999, 10000, 12345, 7];

  function addMixedExpenses() {
    const payers = [alice, bob, carol];
    amounts.forEach((amountCents, i) => {
      const payer = payers[i % payers.length];
      addExpense(payer.id, amountCents, strategy.computeSplits({ amountCents, memberIds: group.memberIds }));
    });
  }

  it("always nets to zero across the group", () => {
    addMixedExpenses();
    expect(computeNetBalances(group.id).reduce((sum, b) => sum + b.netCents, 0)).toBe(0);
  });

  it("only produces positive whole-cent transfers, and fewer than one per member", () => {
    addMixedExpenses();
    const transfers = simplifyDebts(computeNetBalances(group.id));

    expect(transfers.length).toBeLessThan(group.memberIds.length);
    for (const transfer of transfers) {
      expect(Number.isInteger(transfer.amountCents)).toBe(true);
      expect(transfer.amountCents).toBeGreaterThan(0);
      expect(transfer.fromUserId).not.toBe(transfer.toUserId);
    }
  });

  it("brings everyone to exactly zero when the suggested transfers are applied", () => {
    addMixedExpenses();
    const balances = computeNetBalances(group.id);
    const net = new Map(balances.map((b) => [b.userId, b.netCents]));

    for (const transfer of simplifyDebts(balances)) {
      net.set(transfer.fromUserId, (net.get(transfer.fromUserId) ?? 0) + transfer.amountCents);
      net.set(transfer.toUserId, (net.get(transfer.toUserId) ?? 0) - transfer.amountCents);
    }

    expect(Array.from(net.values()).every((cents) => cents === 0)).toBe(true);
  });
});
