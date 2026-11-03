import { beforeEach, describe, expect, it } from "vitest";
import { db, type Group, type User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import {
  addExpense,
  addSettlement,
  makeGroup,
  makeUser,
  netOf,
  resetDb,
  sumNet,
} from "../test-utils/fixtures.js";

let alice: User, bob: User, carol: User;
let group: Group;

beforeEach(() => {
  resetDb();
  alice = makeUser("Alice");
  bob = makeUser("Bob");
  carol = makeUser("Carol");
  group = makeGroup("Trip", [alice, bob, carol]);
});

describe("groups.list", () => {
  it("reports expense count and total per group", async () => {
    const other = makeGroup("Other", [alice, bob]);
    addExpense(group, alice, 1000);
    addExpense(group, bob, 2550);
    addExpense(other, alice, 700);

    const groups = await testCaller().groups.list();

    expect(groups.find((g) => g.id === group.id)).toMatchObject({ expenseCount: 2, totalCents: 3550 });
    expect(groups.find((g) => g.id === other.id)).toMatchObject({ expenseCount: 1, totalCents: 700 });
  });

  it("reports zero for a group with no expenses", async () => {
    const [listed] = await testCaller().groups.list();
    expect(listed).toMatchObject({ expenseCount: 0, totalCents: 0 });
  });

  it("does not count settlements as spending", async () => {
    addExpense(group, alice, 3000);
    addSettlement(group, bob, alice, 1000);

    const [listed] = await testCaller().groups.list();

    expect(listed.totalCents).toBe(3000);
  });

  it("hides archived groups", async () => {
    const caller = testCaller();
    await caller.groups.archive({ groupId: group.id });
    expect(await caller.groups.list()).toEqual([]);
  });
});

describe("groups.archive and groups.unarchive", () => {
  it("sets archivedAt, and unarchiving lists the group again", async () => {
    const caller = testCaller();

    const archived = await caller.groups.archive({ groupId: group.id });
    expect(archived.archivedAt).toBeTypeOf("string");

    const restored = await caller.groups.unarchive({ groupId: group.id });
    expect(restored.archivedAt).toBeUndefined();
    expect((await caller.groups.list()).map((g) => g.id)).toEqual([group.id]);
  });

  it("rejects an unknown group", async () => {
    const caller = testCaller();
    await expect(caller.groups.archive({ groupId: "missing" })).rejects.toThrow(/not found/i);
    await expect(caller.groups.unarchive({ groupId: "missing" })).rejects.toThrow(/not found/i);
  });
});

describe("groups.create", () => {
  it("creates a group that starts with no activity", async () => {
    const caller = testCaller();
    const created = await caller.groups.create({ name: "New", memberIds: [alice.id, bob.id] });

    const detail = await caller.groups.detail({ groupId: created.id });

    expect(created.memberIds).toEqual([alice.id, bob.id]);
    expect(detail.expenses).toEqual([]);
    expect(detail.settlements).toEqual([]);
    expect(detail.suggestedTransfers).toEqual([]);
    expect(detail.categoryTotals).toEqual({});
  });

  it("rejects an empty name", async () => {
    await expect(testCaller().groups.create({ name: "", memberIds: [alice.id] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects an empty member list", async () => {
    await expect(testCaller().groups.create({ name: "New", memberIds: [] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("groups.addMember", () => {
  it("adds the user and charges them only for later expenses", async () => {
    const caller = testCaller();
    const dave = makeUser("Dave");
    addExpense(group, alice, 3000);

    await caller.groups.addMember({ groupId: group.id, userId: dave.id });

    let detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.members.map((m) => m.id)).toContain(dave.id);
    expect(netOf(detail.balances, dave)).toBe(0);

    await caller.quickAdd.create({ groupId: group.id, description: "Taxi", amountCents: 4000, paidByUserId: alice.id });

    detail = await caller.groups.detail({ groupId: group.id });
    expect(netOf(detail.balances, dave)).toBe(-1000);
    expect(sumNet(detail.balances)).toBe(0);
  });

  it("is a no-op for someone who is already a member", async () => {
    const updated = await testCaller().groups.addMember({ groupId: group.id, userId: alice.id });
    expect(updated.memberIds).toEqual([alice.id, bob.id, carol.id]);
  });

  it("rejects an unknown group", async () => {
    await expect(testCaller().groups.addMember({ groupId: "missing", userId: alice.id })).rejects.toThrow(/not found/i);
  });
});

describe("groups.removeMember", () => {
  it("removes a member and stops charging them for later expenses", async () => {
    const caller = testCaller();

    await caller.groups.removeMember({ groupId: group.id, userId: carol.id });
    const expense = await caller.quickAdd.create({
      groupId: group.id,
      description: "Taxi",
      amountCents: 1000,
      paidByUserId: alice.id,
    });

    expect(expense.splits.map((s) => s.userId)).toEqual([alice.id, bob.id]);
    expect((await caller.groups.detail({ groupId: group.id })).members.map((m) => m.id)).toEqual([alice.id, bob.id]);
  });

  it("does not lose money when the removed member has an outstanding balance", async () => {
    const caller = testCaller();
    addExpense(group, alice, 3000);

    // Refusing the removal is also a valid way to protect the balance.
    await caller.groups.removeMember({ groupId: group.id, userId: carol.id }).catch(() => undefined);

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(sumNet(detail.balances)).toBe(0);
    expect(netOf(detail.balances, carol)).toBe(-1000);
  });

  it("rejects an unknown group", async () => {
    await expect(testCaller().groups.removeMember({ groupId: "missing", userId: alice.id })).rejects.toThrow(
      /not found/i
    );
  });
});

describe("groups.delete", () => {
  it("removes the group from list and detail", async () => {
    const caller = testCaller();

    await expect(caller.groups.delete({ groupId: group.id })).resolves.toEqual({ ok: true });

    expect(await caller.groups.list()).toEqual([]);
    await expect(caller.groups.detail({ groupId: group.id })).rejects.toThrow(/not found/i);
  });

  it("leaves other groups' data alone", async () => {
    const other = makeGroup("Other", [alice, bob]);
    const kept = addExpense(other, alice, 500);

    await testCaller().groups.delete({ groupId: group.id });

    expect(db.expenses.get(kept.id)).toBeDefined();
  });

  it("rejects an unknown group", async () => {
    await expect(testCaller().groups.delete({ groupId: "missing" })).rejects.toThrow(/not found/i);
  });
});

describe("groups.detail", () => {
  it("rejects an unknown group", async () => {
    await expect(testCaller().groups.detail({ groupId: "missing" })).rejects.toThrow(/not found/i);
  });

  it("orders expenses and settlements newest first", async () => {
    const oldest = addExpense(group, alice, 100, { createdAt: "2026-01-01T00:00:00.000Z" });
    const newest = addExpense(group, alice, 100, { createdAt: "2026-03-01T00:00:00.000Z" });
    const middle = addExpense(group, alice, 100, { createdAt: "2026-02-01T00:00:00.000Z" });
    const firstPayment = addSettlement(group, bob, alice, 10, "2026-01-01T00:00:00.000Z");
    const lastPayment = addSettlement(group, bob, alice, 10, "2026-02-01T00:00:00.000Z");

    const detail = await testCaller().groups.detail({ groupId: group.id });

    expect(detail.expenses.map((e) => e.id)).toEqual([newest.id, middle.id, oldest.id]);
    expect(detail.settlements.map((s) => s.id)).toEqual([lastPayment.id, firstPayment.id]);
  });

  it("only includes this group's expenses and settlements", async () => {
    const other = makeGroup("Other", [alice, bob]);
    addExpense(other, alice, 999, { category: "Food" });
    addSettlement(other, bob, alice, 100);

    const detail = await testCaller().groups.detail({ groupId: group.id });

    expect(detail.expenses).toEqual([]);
    expect(detail.settlements).toEqual([]);
    expect(detail.categoryTotals).toEqual({});
  });

  it("totals spending per category", async () => {
    addExpense(group, alice, 1000, { category: "Food" });
    addExpense(group, bob, 250, { category: "Food" });
    addExpense(group, carol, 4000, { category: "Lodging" });

    const detail = await testCaller().groups.detail({ groupId: group.id });

    expect(detail.categoryTotals).toEqual({ Food: 1250, Lodging: 4000 });
  });

  it("keeps the expense list total and the category total in agreement", async () => {
    addExpense(group, alice, 1001, { category: "Food" });
    addExpense(group, bob, 2002, { category: "Travel" });
    addSettlement(group, bob, alice, 300);

    const detail = await testCaller().groups.detail({ groupId: group.id });

    const listTotal = detail.expenses.reduce((sum, e) => sum + e.amountCents, 0);
    const categoryTotal = Object.values(detail.categoryTotals).reduce((sum, c) => sum + c, 0);
    expect(listTotal).toBe(3003);
    expect(categoryTotal).toBe(3003);
  });

  it("returns balances and transfers that settle the group", async () => {
    addExpense(group, alice, 9000);

    const detail = await testCaller().groups.detail({ groupId: group.id });

    expect(netOf(detail.balances, alice)).toBe(6000);
    expect(netOf(detail.balances, bob)).toBe(-3000);
    expect(netOf(detail.balances, carol)).toBe(-3000);
    expect(detail.suggestedTransfers).toEqual([
      { fromUserId: bob.id, toUserId: alice.id, amountCents: 3000 },
      { fromUserId: carol.id, toUserId: alice.id, amountCents: 3000 },
    ]);
  });
});
