import { db, nextId, type Expense, type ExpenseSplit, type Group, type Settlement, type User } from "../lib/db.js";
import { computeNetBalances, simplifyDebts, type NetBalance } from "../lib/balances.js";
import { EqualSplitStrategy } from "../lib/split-strategies/equal-split-strategy.js";

const equalSplit = new EqualSplitStrategy();

export function resetDb(): void {
  db.users.clear();
  db.groups.clear();
  db.expenses.clear();
  db.settlements.clear();
  db.deletedExpenses.clear();
  db.deletedSettlements.clear();
}

export function makeUser(name: string): User {
  const username = name.toLowerCase();
  const user: User = {
    id: nextId("user"),
    name,
    email: `${username}@test.com`,
    username,
    password: `${username}-secret`,
  };
  db.users.set(user.id, user);
  return user;
}

export function makeGroup(name: string, members: User[]): Group {
  const group: Group = {
    id: nextId("group"),
    name,
    memberIds: members.map((m) => m.id),
    createdAt: new Date().toISOString(),
  };
  db.groups.set(group.id, group);
  return group;
}

/** Writes straight to the store, so read-side tests don't depend on the routers that create expenses. */
export function addExpense(
  group: Group,
  paidBy: User,
  amountCents: number,
  overrides: { description?: string; category?: string; createdAt?: string; splits?: ExpenseSplit[] } = {}
): Expense {
  const timestamp = overrides.createdAt ?? new Date().toISOString();
  const expense: Expense = {
    id: nextId("expense"),
    groupId: group.id,
    description: overrides.description ?? "test expense",
    amountCents,
    currency: "EUR",
    paidByUserId: paidBy.id,
    paidByUserName: paidBy.name,
    splits: overrides.splits ?? equalSplit.computeSplits({ amountCents, memberIds: group.memberIds }),
    category: overrides.category ?? "Other",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.expenses.set(expense.id, expense);
  return expense;
}

export function addSettlement(
  group: Group,
  from: User,
  to: User,
  amountCents: number,
  createdAt: string = new Date().toISOString()
): Settlement {
  const settlement: Settlement = {
    id: nextId("settlement"),
    groupId: group.id,
    fromUserId: from.id,
    toUserId: to.id,
    amountCents,
    createdAt,
  };
  db.settlements.set(settlement.id, settlement);
  return settlement;
}

/** Pays every suggested transfer, leaving the group fully settled. */
export function settleUp(group: Group): void {
  for (const transfer of simplifyDebts(computeNetBalances(group.id))) {
    addSettlement(
      group,
      db.users.get(transfer.fromUserId) as User,
      db.users.get(transfer.toUserId) as User,
      transfer.amountCents
    );
  }
}

export function netOf(balances: NetBalance[], user: User): number | undefined {
  return balances.find((b) => b.userId === user.id)?.netCents;
}

export function sumNet(balances: NetBalance[]): number {
  return balances.reduce((sum, b) => sum + b.netCents, 0);
}

export function sortedByUser(balances: NetBalance[]): NetBalance[] {
  return [...balances].sort((a, b) => a.userId.localeCompare(b.userId));
}
