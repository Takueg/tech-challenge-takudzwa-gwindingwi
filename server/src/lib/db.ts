import { splitStrategyRegistry } from "./split-strategies/index.js";

export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  bio?: string;
  avatarUrl?: string;
};

export type Group = {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
  archivedAt?: string;
};

export type ExpenseSplit = {
  userId: string;
  amountCents: number;
};

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  amountCents: number;
  currency: "EUR";
  paidByUserId: string;
  /** Snapshot of the payer's name at creation time — not kept in sync if they rename themselves later. */
  paidByUserName: string;
  splits: ExpenseSplit[];
  category: string;
  status: "active";
  notes?: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type Settlement = {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  createdAt: string;
};

export const db = {
  users: new Map<string, User>(),
  groups: new Map<string, Group>(),
  expenses: new Map<string, Expense>(),
  settlements: new Map<string, Settlement>(),
  /** Denormalized per-group expense list, kept in sync by `createExpense`, `expenses.delete` and `groups.delete`. */
  groupExpenseCache: new Map<string, Expense[]>(),
};

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function seed() {
  function makeUser(name: string, username: string): User {
    return {
      id: nextId("user"),
      name,
      email: `${username}@example.com`,
      username,
      password: `${username}123`,
    };
  }

  const alice = makeUser("Alice", "alice");
  const bob = makeUser("Bob", "bob");
  const carol = makeUser("Carol", "carol");
  const dave = makeUser("Dave", "dave");
  const emma = makeUser("Emma", "emma");
  const frank = makeUser("Frank", "frank");
  const grace = makeUser("Grace", "grace");
  const henry = makeUser("Henry", "henry");
  [alice, bob, carol, dave, emma, frank, grace, henry].forEach((u) => db.users.set(u.id, u));

  function makeGroup(name: string, memberIds: string[], createdAt: Date): Group {
    const group: Group = { id: nextId("group"), name, memberIds, createdAt: createdAt.toISOString() };
    db.groups.set(group.id, group);
    db.groupExpenseCache.set(group.id, []);
    return group;
  }

  const trip = makeGroup("Weekend Trip", [alice.id, bob.id, carol.id], new Date(2026, 6, 1));
  const apartment = makeGroup("Apartment 4B", [alice.id, dave.id, emma.id], new Date(2026, 5, 25));
  const skiTrip = makeGroup("Ski Trip 2025", [bob.id, carol.id, frank.id, grace.id], new Date(2026, 5, 15));
  const bookClub = makeGroup("Book Club", [carol.id, emma.id, henry.id], new Date(2026, 6, 8));
  const lunchCrew = makeGroup("Work Lunch Crew", [dave.id, frank.id, henry.id], new Date(2026, 6, 5));

  function addExpense(
    group: Group,
    description: string,
    amountCents: number,
    paidBy: User,
    category: string,
    date: Date
  ): Expense {
    const expense: Expense = {
      id: nextId("expense"),
      groupId: group.id,
      description,
      amountCents,
      currency: "EUR",
      paidByUserId: paidBy.id,
      paidByUserName: paidBy.name,
      splits: splitStrategyRegistry.split("equal", { amountCents, memberIds: group.memberIds }),
      category,
      status: "active",
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    };
    db.expenses.set(expense.id, expense);
    db.groupExpenseCache.set(group.id, [...(db.groupExpenseCache.get(group.id) ?? []), expense]);
    return expense;
  }

  function addSettlement(group: Group, from: User, to: User, amountCents: number, date: Date): void {
    const settlement: Settlement = {
      id: nextId("settlement"),
      groupId: group.id,
      fromUserId: from.id,
      toUserId: to.id,
      amountCents,
      createdAt: date.toISOString(),
    };
    db.settlements.set(settlement.id, settlement);
  }

  // Weekend Trip
  addExpense(trip, "Cabin rental", 24000, bob, "Lodging", new Date(2026, 6, 1, 15, 0));
  addExpense(trip, "Gas for rental car", 3200, bob, "Travel", new Date(2026, 6, 1, 10, 0));
  addExpense(trip, "Dinner at the trattoria", 6200, alice, "Food", new Date(2026, 6, 2, 19, 30));
  addExpense(trip, "Groceries", 3450, carol, "Food", new Date(2026, 6, 2, 11, 0));
  addExpense(trip, "Boat tour", 4500, carol, "Fun", new Date(2026, 6, 3, 14, 0));
  addExpense(trip, "Ice cream", 1450, alice, "Food", new Date(2026, 6, 3, 16, 30));
  addSettlement(trip, carol, bob, 3000, new Date(2026, 6, 5, 9, 0));

  // Apartment 4B
  addExpense(apartment, "Rent - July", 180000, alice, "Other", new Date(2026, 6, 1, 9, 0));
  addExpense(apartment, "Electricity bill", 8734, dave, "Other", new Date(2026, 6, 3, 18, 0));
  addExpense(apartment, "Groceries", 5623, emma, "Food", new Date(2026, 6, 5, 12, 0));
  addExpense(apartment, "Internet bill", 4999, alice, "Other", new Date(2026, 6, 6, 9, 0));
  addExpense(apartment, "Groceries", 3891, dave, "Food", new Date(2026, 6, 12, 17, 0));
  addExpense(apartment, "Cleaning supplies", 1567, emma, "Other", new Date(2026, 6, 14, 11, 0));
  addExpense(apartment, "Rent - August", 180000, alice, "Other", new Date(2026, 7, 1, 9, 0));
  addExpense(apartment, "Groceries", 4712, emma, "Food", new Date(2026, 7, 3, 16, 0));
  addSettlement(apartment, dave, alice, 60000, new Date(2026, 6, 15, 20, 0));

  // Ski Trip 2025
  addExpense(skiTrip, "Chalet rental", 96000, bob, "Lodging", new Date(2026, 5, 19, 20, 0));
  addExpense(skiTrip, "Gas + tolls", 6700, bob, "Travel", new Date(2026, 5, 19, 14, 0));
  addExpense(skiTrip, "Lift tickets", 32000, frank, "Fun", new Date(2026, 5, 20, 8, 0));
  addExpense(skiTrip, "Ski rental", 18000, grace, "Fun", new Date(2026, 5, 20, 9, 0));
  addExpense(skiTrip, "Dinner at the lodge", 15600, carol, "Food", new Date(2026, 5, 20, 19, 30));
  addExpense(skiTrip, "Groceries", 8900, grace, "Food", new Date(2026, 5, 21, 11, 0));
  addExpense(skiTrip, "Hot chocolate stand", 2340, frank, "Food", new Date(2026, 5, 21, 15, 0));
  addSettlement(skiTrip, grace, bob, 15000, new Date(2026, 5, 25, 10, 0));

  // Book Club
  addExpense(bookClub, "Book club snacks", 2450, emma, "Food", new Date(2026, 6, 10, 19, 0));
  addExpense(bookClub, "Wine", 3200, henry, "Fun", new Date(2026, 6, 10, 19, 15));
  addExpense(bookClub, "This month's book", 1899, carol, "Other", new Date(2026, 6, 24, 10, 0));
  addExpense(bookClub, "Coffee shop meetup", 1875, henry, "Food", new Date(2026, 7, 5, 10, 0));

  // Work Lunch Crew
  addExpense(lunchCrew, "Team lunch - pizza", 5600, dave, "Food", new Date(2026, 6, 8, 12, 30));
  addExpense(lunchCrew, "Team lunch - sushi", 7200, frank, "Food", new Date(2026, 6, 15, 12, 30));
  addExpense(lunchCrew, "Coffee run", 1450, henry, "Food", new Date(2026, 6, 22, 10, 0));
  addExpense(lunchCrew, "Team lunch - tacos", 6100, dave, "Food", new Date(2026, 6, 29, 12, 30));
  addExpense(lunchCrew, "Birthday cake for Frank", 3400, henry, "Fun", new Date(2026, 7, 1, 15, 0));
}

seed();
