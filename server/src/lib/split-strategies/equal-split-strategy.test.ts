import { describe, expect, it } from "vitest";
import { EqualSplitStrategy } from "./equal-split-strategy.js";

describe("EqualSplitStrategy", () => {
  const strategy = new EqualSplitStrategy();

  it("has type 'equal'", () => {
    expect(strategy.type).toBe("equal");
  });

  it("returns one split per member", () => {
    const result = strategy.computeSplits({ amountCents: 6200, memberIds: ["a", "b", "c"] });
    expect(result).toHaveLength(3);
  });

  it("splits add up to the total amount", () => {
    const result = strategy.computeSplits({ amountCents: 6200, memberIds: ["a", "b", "c"] });
    const total = result.reduce((sum, s) => sum + s.amountCents, 0);
    expect(total).toBe(6200);
  });

  it("is deterministic for the same input", () => {
    const context = { amountCents: 6200, memberIds: ["a", "b", "c"] };
    expect(strategy.computeSplits(context)).toEqual(strategy.computeSplits(context));
  });

  it("handles an evenly-divisible amount", () => {
    const result = strategy.computeSplits({ amountCents: 3000, memberIds: ["a", "b", "c"] });
    const total = result.reduce((sum, s) => sum + s.amountCents, 0);
    expect(total).toBe(3000);
  });
});
