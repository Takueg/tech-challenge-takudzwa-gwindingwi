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
    const result = await post("users.create", {
      name: "Dana",
      email: "foo",
      username: "dana",
      password: "secret",
    });

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
    const result = await post("expenses.delete", { expenseId: "missing" });
    expect(result).toEqual({ status: 404, message: "Expense missing not found" });
  });

  it("returns 409 for a taken username", async () => {
    makeUser("Alice");
    const result = await post("users.create", {
      name: "Other",
      email: "other@test.com",
      username: "alice",
      password: "secret",
    });
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
