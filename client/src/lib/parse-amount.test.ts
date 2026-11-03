import { describe, expect, it } from "vitest";
import { parseAmount } from "./parse-amount";

describe("parseAmount", () => {
  it.each([
    ["12.50", 1250],
    ["12,50", 1250],
    ["20", 2000],
    ["62.00", 6200],
    ["12,5", 1250],
    ["0,07", 7],
    ["1.234,50", 123450],
    ["1.234", 123400],
    [" 12,50 € ", 1250],
    ["100.000,00", 10000000],
    ["1,15", 115],
  ])("reads %s as %i cents", (input, cents) => {
    expect(parseAmount(input)).toEqual({ cents });
  });

  it("asks for an amount when it's empty", () => {
    expect(parseAmount("   ")).toEqual({ error: "Enter an amount" });
  });

  it.each(["12,5O", "abc", "12,505", "-5", "1,2,3", "12.34.56"])("rejects %s as not a number", (input) => {
    expect(parseAmount(input)).toEqual({ error: "Use numbers only, like 12,50" });
  });

  it.each(["0", "0,00", "0.0"])("rejects %s as zero", (input) => {
    expect(parseAmount(input)).toEqual({ error: "Amount must be more than 0,00 €" });
  });

  it("rejects anything over the limit", () => {
    expect(parseAmount("100.000,01")).toEqual({ error: "That’s over 100.000,00 € — check the amount" });
  });
});
