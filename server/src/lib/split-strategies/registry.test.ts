import { describe, expect, it } from "vitest";
import { splitStrategyRegistry } from "./registry.js";

describe("splitStrategyRegistry", () => {
  it("looks up the equal strategy by type", () => {
    expect(splitStrategyRegistry.resolveByType("equal").type).toBe("equal");
  });

  it("throws for an unknown type", () => {
    expect(() => splitStrategyRegistry.resolveByType("percentage")).toThrow(/unknown split strategy/i);
  });

  it("computes splits through split()", () => {
    expect(splitStrategyRegistry.split("equal", { amountCents: 100, memberIds: ["a", "b"] })).toEqual([
      { userId: "a", amountCents: 50 },
      { userId: "b", amountCents: 50 },
    ]);
  });

  it("validates before computing, so split() can't skip validation", () => {
    expect(() => splitStrategyRegistry.split("equal", { amountCents: 100, memberIds: [] })).toThrow(/no members/i);
  });

  it("auto-detects the equal strategy when there is no metadata", () => {
    expect(splitStrategyRegistry.resolve({ amountCents: 100, memberIds: ["a"] }).type).toBe("equal");
  });

  it("throws when no strategy can handle the metadata", () => {
    expect(() =>
      splitStrategyRegistry.resolve({ amountCents: 100, memberIds: ["a"], metadata: { percentages: [100] } })
    ).toThrow(/no registered split strategy/i);
  });
});
