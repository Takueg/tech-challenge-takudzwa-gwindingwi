import { describe, expect, it } from "vitest";
import { csvField } from "./csv.js";

describe("csvField", () => {
  it("quotes plain text", () => {
    expect(csvField("Dinner")).toBe('"Dinner"');
  });

  it("escapes double quotes", () => {
    expect(csvField('The "good" pizza')).toBe('"The ""good"" pizza"');
  });

  it.each(["=SUM(A1:A9)", "+1+1", "-1+1", "@SUM(A1)", "\t=1", "\r=1"])(
    "stops a spreadsheet treating %j as a formula",
    (value) => {
      expect(csvField(value)).toBe(`"'${value}"`);
    }
  );

  it("leaves formula characters alone when they aren't at the start", () => {
    expect(csvField("Dinner = great")).toBe('"Dinner = great"');
  });

  it("leaves exported amounts as plain numbers", () => {
    expect(csvField("12.50")).toBe('"12.50"');
  });
});
