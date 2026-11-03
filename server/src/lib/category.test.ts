import { describe, expect, it } from "vitest";
import { detectExpenseCategory } from "./category.js";

describe("detectExpenseCategory", () => {
  it.each([
    ["Dinner at the trattoria", "Food"],
    ["Weekly groceries", "Food"],
    ["Train to Berlin", "Travel"],
    ["Fuel", "Travel"],
    ["Hotel room", "Lodging"],
    ["Airbnb", "Lodging"],
    ["Concert tickets", "Fun"],
    ["Birthday present", "Other"],
  ])("categorizes %j as %s", async (description, category) => {
    expect(await detectExpenseCategory(description)).toBe(category);
  });

  it("matches plurals of a keyword", async () => {
    expect(await detectExpenseCategory("Two flights")).toBe("Travel");
  });

  it("ignores case", async () => {
    expect(await detectExpenseCategory("DINNER")).toBe("Food");
  });
});
