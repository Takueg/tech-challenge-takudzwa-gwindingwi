import { describe, expect, it } from "vitest";
import { shareOf } from "./share";

const expense = {
  splits: [
    { userId: "a", amountCents: 34 },
    { userId: "b", amountCents: 33 },
    { userId: "c", amountCents: 33 },
  ],
};

describe("shareOf", () => {
  it("returns what the split actually charges, including leftover cents", () => {
    expect(shareOf(expense, "a")).toBe(34);
    expect(shareOf(expense, "b")).toBe(33);
  });

  it("returns undefined for someone who isn't on the expense", () => {
    expect(shareOf(expense, "d")).toBeUndefined();
  });

  it("returns undefined when nobody is logged in", () => {
    expect(shareOf(expense, null)).toBeUndefined();
  });
});
