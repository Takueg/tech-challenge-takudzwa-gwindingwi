import { describe, expect, it } from "vitest";
import { errorMessage, isRejection } from "./error-message";

function apiError(message: string, httpStatus: number) {
  return Object.assign(new Error(message), { data: { httpStatus } });
}

describe("errorMessage", () => {
  it("shows the server's message for an expected failure", () => {
    expect(errorMessage(apiError("Everyone needs to settle up", 409))).toBe("Everyone needs to settle up");
  });

  it("hides the details of a server crash", () => {
    expect(errorMessage(apiError("Cannot read properties of undefined", 500))).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("doesn't blame the user when the server can't be reached", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe("Something went wrong. Please try again.");
  });

  it("handles something that isn't an error at all", () => {
    expect(errorMessage(undefined)).toBe("Something went wrong. Please try again.");
  });
});

describe("isRejection", () => {
  it("is true for a 4xx", () => {
    expect(isRejection(apiError("No", 409))).toBe(true);
  });

  it("is false for a crash or an outage", () => {
    expect(isRejection(apiError("Boom", 500))).toBe(false);
    expect(isRejection(new TypeError("Failed to fetch"))).toBe(false);
  });
});
