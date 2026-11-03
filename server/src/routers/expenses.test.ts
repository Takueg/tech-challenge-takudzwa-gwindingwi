import { beforeEach, describe, expect, it } from "vitest";
import { db, nextId, type Group, type User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";

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
  db.groupExpenseCache.set(group.id, []);
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

    await caller.expenses.delete({ expenseId: expense.id });

    const detail = await caller.groups.detail({ groupId: group.id });
    expect(detail.expenses.find((e) => e.id === expense.id)).toBeUndefined();
  });

  it("rejects deleting an expense that doesn't exist", async () => {
    const caller = testCaller();
    await expect(caller.expenses.delete({ expenseId: "nonexistent" })).rejects.toThrow();
  });
});
