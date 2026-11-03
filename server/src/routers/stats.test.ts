import { beforeEach, describe, expect, it } from "vitest";
import type { Group, User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { addExpense, addSettlement, makeGroup, makeUser, resetDb } from "../test-utils/fixtures.js";

let alice: User, bob: User;
let group: Group, other: Group;

beforeEach(() => {
  resetDb();
  alice = makeUser("Alice");
  bob = makeUser("Bob");
  group = makeGroup("Trip", [alice, bob]);
  other = makeGroup("Flat", [alice, bob]);
});

describe("stats.overview", () => {
  it("reports zero spending with no expenses", async () => {
    expect(await testCaller().stats.overview()).toEqual({ groupCount: 2, expenseCount: 0, totalCents: 0 });
  });

  it("totals expenses across groups and ignores settlements", async () => {
    addExpense(group, alice, 1000);
    addExpense(other, bob, 2500);
    addSettlement(group, bob, alice, 500);

    expect(await testCaller().stats.overview()).toEqual({ groupCount: 2, expenseCount: 2, totalCents: 3500 });
  });

  it("reflects an edited and a deleted expense", async () => {
    const caller = testCaller();
    const edited = addExpense(group, alice, 1000);
    const deleted = addExpense(group, alice, 2000);

    await caller.expenses.update({ expenseId: edited.id, description: "Edited", amountCents: 1500 });
    await caller.expenses.delete({ expenseId: deleted.id });

    expect(await caller.stats.overview()).toMatchObject({ expenseCount: 1, totalCents: 1500 });
  });

  it("excludes the expenses of a deleted group", async () => {
    const caller = testCaller();
    addExpense(group, alice, 1000);
    addExpense(other, bob, 2500);

    await caller.groups.delete({ groupId: group.id });

    expect(await caller.stats.overview()).toEqual({ groupCount: 1, expenseCount: 1, totalCents: 2500 });
  });
});

describe("stats.recentExpenses", () => {
  it("returns the five newest expenses, newest first", async () => {
    const descriptions = ["one", "two", "three", "four", "five", "six", "seven"];
    descriptions.forEach((description, i) => {
      addExpense(group, alice, 100, { description, createdAt: `2026-01-0${i + 1}T00:00:00.000Z` });
    });

    const recent = await testCaller().stats.recentExpenses();

    expect(recent.map((e) => e.description)).toEqual(["seven", "six", "five", "four", "three"]);
  });

  it("returns an empty list with no expenses", async () => {
    expect(await testCaller().stats.recentExpenses()).toEqual([]);
  });

  it("excludes the expenses of a deleted group", async () => {
    const caller = testCaller();
    addExpense(group, alice, 1000);

    await caller.groups.delete({ groupId: group.id });

    expect(await caller.stats.recentExpenses()).toEqual([]);
  });
});

describe("stats.leaderboard", () => {
  it("ranks payers by total paid across groups, highest first", async () => {
    addExpense(group, alice, 1000);
    addExpense(other, alice, 500);
    addExpense(group, bob, 2000);

    expect(await testCaller().stats.leaderboard()).toEqual([
      { userId: bob.id, userName: "Bob", totalCents: 2000 },
      { userId: alice.id, userName: "Alice", totalCents: 1500 },
    ]);
  });

  it("leaves out users who haven't paid for anything", async () => {
    addExpense(group, alice, 1000);

    const leaderboard = await testCaller().stats.leaderboard();

    expect(leaderboard.map((entry) => entry.userId)).toEqual([alice.id]);
  });

  it("does not count settlements as paying", async () => {
    addExpense(group, alice, 1000);
    addSettlement(group, bob, alice, 500);

    const leaderboard = await testCaller().stats.leaderboard();

    expect(leaderboard).toEqual([{ userId: alice.id, userName: "Alice", totalCents: 1000 }]);
  });

  it("shows a payer's current name after they rename themselves", async () => {
    const caller = testCaller();
    addExpense(group, alice, 1000);

    await caller.users.update({ userId: alice.id, name: "Alicia", email: "alicia@test.com" });

    expect((await caller.stats.leaderboard())[0].userName).toBe("Alicia");
  });

  it("excludes the expenses of a deleted group", async () => {
    const caller = testCaller();
    addExpense(group, alice, 1000);

    await caller.groups.delete({ groupId: group.id });

    expect(await caller.stats.leaderboard()).toEqual([]);
  });
});
