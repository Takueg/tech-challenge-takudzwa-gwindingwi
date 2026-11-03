import { beforeEach, describe, expect, it } from "vitest";
import { db, nextId, type Expense, type Group, type User } from "./db.js";
import { computeNetBalances, simplifyDebts } from "./balances.js";

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
