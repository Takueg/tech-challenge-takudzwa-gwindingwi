import { beforeEach, describe, expect, it } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./index.js";
import { addExpense, makeGroup, makeUser, resetDb } from "../test-utils/fixtures.js";

// The test caller skips the HTTP layer, and status codes and formatted messages only exist there.
async function post(path: string, input: unknown) {
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    router: appRouter,
    req: new Request(`http://test/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  });
  const body = (await response.json()) as { error: { message: string } };
  return { status: response.status, message: body.error.message };
}

beforeEach(() => {
  resetDb();
});

describe("errors over HTTP", () => {
  it("returns a readable message for a validation failure, not raw JSON", async () => {
    const result = await post("users.update", { userId: "anyone", name: "Dana", email: "foo" });

    expect(result).toEqual({ status: 400, message: "email: Invalid email" });
  });

  it("explains a blank description", async () => {
    const result = await post("expenses.create", {
      groupId: "any",
      description: "   ",
      amountCents: 100,
      paidByUserId: "any",
    });

    expect(result).toEqual({ status: 400, message: "description: Can't be blank" });
  });

  it("explains an amount that's too large", async () => {
    const result = await post("expenses.create", {
      groupId: "any",
      description: "Dinner",
      amountCents: Number.MAX_SAFE_INTEGER + 1,
      paidByUserId: "any",
    });

    expect(result).toEqual({ status: 400, message: "amountCents: That amount is too large" });
  });

  it("returns 401 for a wrong password", async () => {
    makeUser("Alice");
    const result = await post("auth.login", { username: "alice", password: "wrong" });
    expect(result).toEqual({ status: 401, message: "Unknown username or password" });
  });

  it("returns 404 for an unknown group", async () => {
    const result = await post("groups.archive", { groupId: "missing" });
    expect(result).toEqual({ status: 404, message: "Group missing not found" });
  });

  it("returns 404 for an unknown expense", async () => {
    const result = await post("expenses.delete", { expenseId: "missing", userId: "anyone" });
    expect(result).toEqual({ status: 404, message: "Expense missing not found" });
  });

  it("returns 409 for an email another account uses", async () => {
    const alice = makeUser("Alice");
    const bob = makeUser("Bob");
    const result = await post("users.update", { userId: alice.id, name: "Alice", email: bob.email });
    expect(result.status).toBe(409);
  });

  it("returns 409 when archiving or deleting a group with debts", async () => {
    const alice = makeUser("Alice");
    const bob = makeUser("Bob");
    const group = makeGroup("Trip", [alice, bob]);
    addExpense(group, alice, 1000);

    expect((await post("groups.archive", { groupId: group.id })).status).toBe(409);
    expect((await post("groups.delete", { groupId: group.id })).status).toBe(409);
  });

  it("returns 400 for a payer outside the group", async () => {
    const alice = makeUser("Alice");
    const group = makeGroup("Trip", [alice]);
    const outsider = makeUser("Outsider");

    const result = await post("expenses.create", {
      groupId: group.id,
      description: "Dinner",
      amountCents: 100,
      paidByUserId: outsider.id,
    });

    expect(result.status).toBe(400);
  });
});

describe("input limits", () => {
  it("refuses an expense description over 60 characters", async () => {
    const alice = makeUser("Alice");
    const group = makeGroup("Trip", [alice]);
    const result = await post("expenses.create", {
      groupId: group.id,
      description: "x".repeat(61),
      amountCents: 100,
      paidByUserId: alice.id,
    });
    expect(result).toEqual({ status: 400, message: "description: Keep it under 60 characters" });
  });

  it("refuses a group name over 40 characters", async () => {
    const alice = makeUser("Alice");
    const result = await post("groups.create", { name: "x".repeat(41), memberIds: [alice.id] });
    expect(result).toEqual({ status: 400, message: "name: Keep the name under 40 characters" });
  });

  it("refuses a user name over 40 characters and a bio over 160", async () => {
    const alice = makeUser("Alice");
    const longName = await post("users.update", { userId: alice.id, name: "x".repeat(41), email: alice.email });
    const longBio = await post("users.update", { userId: alice.id, name: "A", email: alice.email, bio: "x".repeat(161) });
    expect(longName.status).toBe(400);
    expect(longBio).toEqual({ status: 400, message: "bio: Keep your bio under 160 characters" });
  });

  it("refuses a photo too big to have come from a 2 MB file", async () => {
    const alice = makeUser("Alice");
    const result = await post("users.updateAvatar", { userId: alice.id, avatarUrl: "x".repeat(3_000_001) });
    expect(result).toEqual({ status: 400, message: "avatarUrl: That photo is too big" });
  });
});
