import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "./log-server-error.js";

describe("logServerError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs a crash with its path and cause", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("boom");

    logServerError({ error: new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause }), path: "groups.detail" });

    expect(spy).toHaveBeenCalledWith("tRPC groups.detail failed:", cause);
  });

  it("stays quiet for an expected failure", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerError({ error: new TRPCError({ code: "NOT_FOUND" }), path: "groups.detail" });

    expect(spy).not.toHaveBeenCalled();
  });
});
