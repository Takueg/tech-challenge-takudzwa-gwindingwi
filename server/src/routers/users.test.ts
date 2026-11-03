import { beforeEach, describe, expect, it } from "vitest";
import { db, type User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { addExpense, makeGroup, makeUser, resetDb } from "../test-utils/fixtures.js";

const validInput = { name: "Dana", email: "dana@test.com", username: "dana", password: "dana-secret" };

let alice: User;

beforeEach(() => {
  resetDb();
  alice = makeUser("Alice");
});

describe("users.list", () => {
  it("returns every user", async () => {
    makeUser("Bob");
    const users = await testCaller().users.list();
    expect(users.map((u) => u.name)).toEqual(["Alice", "Bob"]);
  });

  it("does not expose passwords", async () => {
    const users = await testCaller().users.list();
    for (const user of users) expect(user).not.toHaveProperty("password");
  });
});

describe("users.create", () => {
  it("stores a new user that can then be listed", async () => {
    const caller = testCaller();
    const created = await caller.users.create(validInput);

    expect(created).toMatchObject({ name: "Dana", email: "dana@test.com", username: "dana" });
    expect(db.users.has(created.id)).toBe(true);
    expect((await caller.users.list()).map((u) => u.id)).toContain(created.id);
  });

  it("does not return the password in the response", async () => {
    const created = await testCaller().users.create(validInput);
    expect(created).not.toHaveProperty("password");
  });

  it("rejects a username that is already taken", async () => {
    await expect(testCaller().users.create({ ...validInput, username: "alice" })).rejects.toThrow();
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a whitespace-only name", { name: "   " }],
    ["an invalid email", { email: "not-an-email" }],
    ["an empty username", { username: "" }],
    ["a whitespace-only username", { username: "   " }],
    ["an empty password", { password: "" }],
  ])("rejects %s", async (_label, override) => {
    await expect(testCaller().users.create({ ...validInput, ...override })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("users.update", () => {
  it("updates name, email and bio", async () => {
    const updated = await testCaller().users.update({
      userId: alice.id,
      name: "Alicia",
      email: "alicia@test.com",
      bio: "Hello",
    });

    expect(updated).toMatchObject({ name: "Alicia", email: "alicia@test.com", bio: "Hello" });
    expect(db.users.get(alice.id)?.name).toBe("Alicia");
  });

  it("does not return the password in the response", async () => {
    const updated = await testCaller().users.update({ userId: alice.id, name: "Alicia", email: "alicia@test.com" });
    expect(updated).not.toHaveProperty("password");
  });

  it("renames the user on expenses they paid for, and nobody else's", async () => {
    const bob = makeUser("Bob");
    const group = makeGroup("Trip", [alice, bob]);
    const paidByAlice = addExpense(group, alice, 1000);
    const paidByBob = addExpense(group, bob, 1000);

    await testCaller().users.update({ userId: alice.id, name: "Alicia", email: "alicia@test.com" });

    expect(db.expenses.get(paidByAlice.id)?.paidByUserName).toBe("Alicia");
    expect(db.expenses.get(paidByBob.id)?.paidByUserName).toBe("Bob");
  });

  it("rejects an unknown user", async () => {
    await expect(
      testCaller().users.update({ userId: "missing", name: "X", email: "x@test.com" })
    ).rejects.toThrow(/not found/i);
  });

  it.each([
    ["an empty name", { name: "", email: "a@test.com" }],
    ["a whitespace-only name", { name: "   ", email: "a@test.com" }],
    ["an invalid email", { name: "A", email: "nope" }],
  ])("rejects %s", async (_label, input) => {
    await expect(testCaller().users.update({ userId: alice.id, ...input })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("users.updateAvatar", () => {
  it("stores the avatar url", async () => {
    const updated = await testCaller().users.updateAvatar({ userId: alice.id, avatarUrl: "data:image/png;base64,AAA" });
    expect(updated.avatarUrl).toBe("data:image/png;base64,AAA");
    expect(db.users.get(alice.id)?.avatarUrl).toBe("data:image/png;base64,AAA");
  });

  it("does not return the password in the response", async () => {
    const updated = await testCaller().users.updateAvatar({ userId: alice.id, avatarUrl: "x" });
    expect(updated).not.toHaveProperty("password");
  });

  it("rejects an unknown user", async () => {
    await expect(testCaller().users.updateAvatar({ userId: "missing", avatarUrl: "x" })).rejects.toThrow(/not found/i);
  });
});
