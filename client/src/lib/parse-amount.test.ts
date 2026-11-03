import { describe, expect, it } from "vitest";
import { parseAmountToCents } from "./parse-amount";

describe("parseAmountToCents", () => {
  it("parses a plain decimal amount", () => {
    expect(parseAmountToCents("12.50")).toBe(1250);
  });

  it("parses a comma-decimal amount", () => {
    expect(parseAmountToCents("12,50")).toBe(1250);
  });

  it("parses a whole-euro amount", () => {
    expect(parseAmountToCents("20")).toBe(2000);
  });

  it("is consistent with itself across repeated calls", () => {
    expect(parseAmountToCents("62.00")).toBe(parseAmountToCents("62.00"));
  });

  it("rounds to the nearest cent", () => {
    expect(parseAmountToCents("9.999")).toBe(1000);
  });
});
