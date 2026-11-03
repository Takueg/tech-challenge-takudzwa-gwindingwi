import { describe, expect, it } from "vitest";
import { roundingNote, settleHint, splitSentence } from "./split-preview";

const even = [
  { userId: "a", amountCents: 1200 },
  { userId: "b", amountCents: 1200 },
  { userId: "c", amountCents: 1200 },
];
const uneven = [
  { userId: "a", amountCents: 334 },
  { userId: "b", amountCents: 333 },
  { userId: "c", amountCents: 333 },
];

// Intl puts a non-breaking space before the euro sign.
const plain = (text: string) => text.replace(/ /g, " ");

describe("splitSentence", () => {
  it("reads as the design's sentence for an even split", () => {
    expect(plain(splitSentence(even, 3600, "a"))).toBe("Each of the 3 members pays 12,00 €. You’ll be owed 24,00 €.");
  });

  it("names both amounts when the split isn't even, and uses the payer's real share", () => {
    expect(plain(splitSentence(uneven, 1000, "b"))).toBe(
      "Each of the 3 members pays 3,33 € or 3,34 €. You’ll be owed 6,67 €."
    );
  });
});

describe("roundingNote", () => {
  it("says when nothing needed rounding", () => {
    expect(roundingNote(even)).toBe("Splits evenly — no rounding needed.");
  });

  it("uses the singular for one cent", () => {
    expect(roundingNote(uneven)).toBe("The extra 1 cent goes to the first person so the total adds up.");
  });

  it("counts several cents", () => {
    const two = [
      { userId: "a", amountCents: 34 },
      { userId: "b", amountCents: 34 },
      { userId: "c", amountCents: 33 },
    ];
    expect(roundingNote(two)).toBe("The extra 2 cents go to the first 2 people so the total adds up.");
  });
});

describe("settleHint", () => {
  it("counts both directions", () => {
    expect(settleHint(5, 3)).toBe("5 people owe you · you owe 3");
  });

  it("uses the singular for one person", () => {
    expect(settleHint(1, 0)).toBe("1 person owes you · you owe 0");
  });

  it("says you're settled with no debts", () => {
    expect(settleHint(0, 0)).toBe("You’re all settled up");
  });
});
