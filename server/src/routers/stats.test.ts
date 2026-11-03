import { beforeEach, describe, expect, it } from "vitest";
import type { Group, User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { addExpense, addSettlement, makeGroup, makeUser, resetDb, settleUp } from "../test-utils/fixtures.js";

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
    expect(await testCaller().stats.overview()).toEqual({
      groupCount: 2,
      expenseCount: 0,
      totalCents: 0,
      categoryTotals: {},
    });
  });

  it("totals expenses across groups and ignores settlements", async () => {
    addExpense(group, alice, 1000);
    addExpense(other, bob, 2500);
    addSettlement(group, bob, alice, 500);

    expect(await testCaller().stats.overview()).toEqual({
      groupCount: 2,
      expenseCount: 2,
      totalCents: 3500,
      categoryTotals: { Other: 3500 },
    });
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

    settleUp(group);
    await caller.groups.delete({ groupId: group.id });

    expect(await caller.stats.overview()).toEqual({
      groupCount: 1,
      expenseCount: 1,
      totalCents: 2500,
      categoryTotals: { Other: 2500 },
    });
  });

  it("agrees with the visible group list once a group is archived", async () => {
    const caller = testCaller();
    addExpense(group, alice, 1000);
    addExpense(other, bob, 2500);
    settleUp(group);

    await caller.groups.archive({ groupId: group.id });

    const visible = await caller.groups.list();
    const overview = await caller.stats.overview();
    expect(overview.groupCount).toBe(visible.length);
    expect(overview.totalCents).toBe(visible.reduce((sum, g) => sum + g.totalCents, 0));
  });
});

describe("stats after archiving", () => {
  it("excludes the archived group's expenses everywhere, and restores them on unarchive", async () => {
    const caller = testCaller();
    addExpense(group, alice, 1000);
    addExpense(other, bob, 2500);
    settleUp(group);

    await caller.groups.archive({ groupId: group.id });

    expect(await caller.stats.overview()).toEqual({
      groupCount: 1,
      expenseCount: 1,
      totalCents: 2500,
      categoryTotals: { Other: 2500 },
    });
    expect((await caller.stats.leaderboard()).map((entry) => entry.userId)).toEqual([bob.id]);

    await caller.groups.unarchive({ groupId: group.id });

    expect(await caller.stats.overview()).toEqual({
      groupCount: 2,
      expenseCount: 2,
      totalCents: 3500,
      categoryTotals: { Other: 3500 },
    });
    expect((await caller.stats.leaderboard()).map((entry) => entry.userId)).toEqual([bob.id, alice.id]);
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

    settleUp(group);
    await caller.groups.delete({ groupId: group.id });

    expect(await caller.stats.leaderboard()).toEqual([]);
  });
});

describe("stats.overview categoryTotals", () => {
  it("sums each category and leaves out archived groups", async () => {
    const caller = testCaller();
    addExpense(group, alice, 1000, { category: "Food" });
    addExpense(group, bob, 500, { category: "Food" });
    addExpense(other, alice, 2000, { category: "Rent" });
    settleUp(other);
    await caller.groups.archive({ groupId: other.id });

    expect((await caller.stats.overview()).categoryTotals).toEqual({ Food: 1500 });
  });
});

describe("stats.myBalances", () => {
  it("keeps what you're owed and what you owe apart across groups", async () => {
    addExpense(group, alice, 1000);
    addExpense(other, bob, 3000);

    expect(await testCaller().stats.myBalances({ userId: alice.id })).toEqual({
      owedCents: 500,
      oweCents: 1500,
      perGroup: [
        { groupId: group.id, netCents: 500 },
        { groupId: other.id, netCents: -1500 },
      ],
    });
  });

  it("leaves out archived groups", async () => {
    const caller = testCaller();
    addExpense(other, alice, 1000);
    settleUp(other);
    await caller.groups.archive({ groupId: other.id });

    const { perGroup } = await caller.stats.myBalances({ userId: alice.id });
    expect(perGroup.map((g) => g.groupId)).toEqual([group.id]);
  });

  it("leaves out groups the user has no part in", async () => {
    const outsider = makeUser("Outsider");
    addExpense(group, alice, 1000);

    expect(await testCaller().stats.myBalances({ userId: outsider.id })).toEqual({
      owedCents: 0,
      oweCents: 0,
      perGroup: [],
    });
  });
});
