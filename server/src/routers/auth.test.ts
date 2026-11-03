import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "../lib/db.js";
import { testCaller } from "../test-utils/caller.js";
import { makeUser, resetDb } from "../test-utils/fixtures.js";

let alice: User;

beforeEach(() => {
  resetDb();
  alice = makeUser("Alice");
});

describe("auth.login", () => {
  it("returns the matching user for correct credentials", async () => {
    const user = await testCaller().auth.login({ username: "alice", password: "alice-secret" });
    expect(user.id).toBe(alice.id);
    expect(user.name).toBe("Alice");
  });

  it("rejects an unknown username", async () => {
    await expect(testCaller().auth.login({ username: "nobody", password: "x" })).rejects.toThrow(/unknown username/i);
  });

  it("rejects a wrong password", async () => {
    await expect(testCaller().auth.login({ username: "alice", password: "wrong" })).rejects.toThrow();
  });

  it("gives the same error for a wrong password as for an unknown username", async () => {
    const caller = testCaller();
    const wrongPassword = await caller.auth.login({ username: "alice", password: "wrong" }).catch((e: Error) => e.message);
    const unknownUser = await caller.auth.login({ username: "nobody", password: "wrong" }).catch((e: Error) => e.message);
    expect(wrongPassword).toBe(unknownUser);
  });

  it("rejects an empty password", async () => {
    await expect(testCaller().auth.login({ username: "alice", password: "" })).rejects.toThrow();
  });

  it("does not return the password in the response", async () => {
    const user = await testCaller().auth.login({ username: "alice", password: "alice-secret" });
    expect(user).not.toHaveProperty("password");
  });
});
