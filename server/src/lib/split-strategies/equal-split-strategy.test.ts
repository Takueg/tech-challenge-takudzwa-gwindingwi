import { describe, expect, it } from "vitest";
import { EqualSplitStrategy } from "./equal-split-strategy.js";
import type { SplitStrategy } from "./types.js";

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

  it("gives leftover cents to the first members in list order", () => {
    const amounts = (amountCents: number) =>
      strategy.computeSplits({ amountCents, memberIds: ["a", "b", "c"] }).map((s) => s.amountCents);

    expect(amounts(100)).toEqual([34, 33, 33]);
    expect(amounts(101)).toEqual([34, 34, 33]);
    expect(amounts(102)).toEqual([34, 34, 34]);
  });

  it("gives a single cent to one member and zero to the rest", () => {
    const result = strategy.computeSplits({ amountCents: 1, memberIds: ["a", "b", "c"] });
    expect(result.map((s) => s.amountCents)).toEqual([1, 0, 0]);
  });

  it("gives a lone member the whole amount", () => {
    expect(strategy.computeSplits({ amountCents: 999, memberIds: ["a"] })).toEqual([{ userId: "a", amountCents: 999 }]);
  });

  it("always adds up, with no share differing by more than a cent", () => {
    for (const amountCents of [1, 2, 7, 99, 100, 101, 3333, 10000, 123456789]) {
      for (const memberCount of [1, 2, 3, 4, 7, 13]) {
        const memberIds = Array.from({ length: memberCount }, (_, i) => `user_${i}`);
        const shares = strategy.computeSplits({ amountCents, memberIds }).map((s) => s.amountCents);

        expect(shares.reduce((sum, share) => sum + share, 0)).toBe(amountCents);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("passes validation with at least one member", () => {
    const viaInterface: SplitStrategy = strategy;
    expect(viaInterface.validate({ amountCents: 100, memberIds: ["a"] }).valid).toBe(true);
  });

  it("only handles input without strategy-specific metadata", () => {
    const base = { amountCents: 100, memberIds: ["a"] };
    expect(strategy.canHandle(base)).toBe(true);
    expect(strategy.canHandle({ ...base, metadata: {} })).toBe(true);
    expect(strategy.canHandle({ ...base, metadata: { percentages: [100] } })).toBe(false);
  });
});
