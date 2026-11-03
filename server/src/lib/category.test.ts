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

  it.each([
    ["Team lunches", "Food"],
    ["Gasoline", "Travel"],
    ["Two taxis", "Travel"],
    ["Hostels", "Lodging"],
    ["Cafes", "Food"],
  ])("still categorizes %j as %s", async (description, category) => {
    expect(await detectExpenseCategory(description)).toBe(category);
  });

  it("ignores case", async () => {
    expect(await detectExpenseCategory("DINNER")).toBe("Food");
  });

  it.each([
    ["Cabin rental", "Lodging"],
    ["Las Vegas hotel", "Lodging"],
    ["Barber", "Other"],
    ["Marathon training", "Other"],
  ])("matches whole words, so %j is %s", async (description, category) => {
    expect(await detectExpenseCategory(description)).toBe(category);
  });
});
