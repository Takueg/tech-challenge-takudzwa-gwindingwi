import { describe, expect, it } from "vitest";
import { barPercent, spendersFromExpenses, toPieSlices } from "./charts";

describe("toPieSlices", () => {
  it("orders up to three categories largest first", () => {
    expect(toPieSlices({ Food: 100, Rent: 300, Fun: 200 }).map((s) => s.label)).toEqual(["Rent", "Fun", "Food"]);
  });

  it("merges the rest into Everything Else past three", () => {
    expect(toPieSlices({ Rent: 500, Food: 300, Fun: 100, Other: 50 })).toEqual([
      { label: "Rent", value: 500 },
      { label: "Food", value: 300 },
      { label: "Everything Else", value: 150 },
    ]);
  });

  it("is empty with nothing spent", () => {
    expect(toPieSlices({})).toEqual([]);
  });
});

describe("spendersFromExpenses", () => {
  it("adds up each payer and sorts biggest first", () => {
    expect(
      spendersFromExpenses([
        { paidByUserId: "a", paidByUserName: "Alice", amountCents: 100 },
        { paidByUserId: "b", paidByUserName: "Bob", amountCents: 250 },
        { paidByUserId: "a", paidByUserName: "Alice", amountCents: 100 },
      ])
    ).toEqual([
      { userId: "b", userName: "Bob", totalCents: 250 },
      { userId: "a", userName: "Alice", totalCents: 200 },
    ]);
  });
});

describe("barPercent", () => {
  it("scales against the top spender", () => {
    expect(barPercent(500, 1000)).toBe(50);
    expect(barPercent(1000, 1000)).toBe(100);
  });

  it("never goes below 2%", () => {
    expect(barPercent(1, 100000)).toBe(2);
  });
});
