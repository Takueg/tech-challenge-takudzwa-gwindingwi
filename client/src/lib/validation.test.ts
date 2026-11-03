import { describe, expect, it } from "vitest";
import {
  errorSummary,
  hasErrors,
  revalidate,
  validateDescription,
  validateGroupName,
  validatePhoto,
  validateProfile,
} from "./validation";

describe("revalidate", () => {
  it("clears an error once its field is fixed", () => {
    expect(revalidate({ name: "Required" }, {})).toEqual({});
  });

  it("doesn't flag a field that wasn't showing an error yet", () => {
    expect(revalidate({ name: "Required" }, { name: "Required", email: "Bad" })).toEqual({ name: "Required" });
  });

  it("updates the message when the problem changes", () => {
    expect(revalidate({ amount: "Enter an amount" }, { amount: "Use numbers only" })).toEqual({
      amount: "Use numbers only",
    });
  });
});

describe("errorSummary", () => {
  it("is empty with no errors", () => {
    expect(errorSummary({}, "save")).toBe("");
    expect(hasErrors({ name: undefined })).toBe(false);
  });

  it("uses the singular for one field", () => {
    expect(errorSummary({ name: "x" }, "save")).toBe("Fix the highlighted field to save.");
  });

  it("counts several fields", () => {
    expect(errorSummary({ name: "x", email: "y" }, "add this expense")).toBe(
      "Fix the 2 highlighted fields to add this expense."
    );
  });
});

describe("validateDescription", () => {
  it("requires text, ignoring spaces", () => {
    expect(validateDescription("   ")).toBe("Add a short description");
  });

  it("allows 60 characters and refuses 61", () => {
    expect(validateDescription("x".repeat(60))).toBeUndefined();
    expect(validateDescription("x".repeat(61))).toBe("Keep it under 60 characters");
  });
});

describe("validateGroupName", () => {
  it("requires a name", () => {
    expect(validateGroupName(" ", [])).toBe("Give your group a name");
  });

  it("allows 40 characters and refuses 41", () => {
    expect(validateGroupName("x".repeat(40), [])).toBeUndefined();
    expect(validateGroupName("x".repeat(41), [])).toBe("Keep the name under 40 characters");
  });

  it("refuses a duplicate, ignoring case and outer spaces", () => {
    expect(validateGroupName(" weekend trip ", ["Weekend Trip"])).toBe("You already have a group called “weekend trip”");
  });
});

describe("validateProfile", () => {
  const valid = { name: "Alice", email: "alice@example.com", bio: "" };

  it("accepts a valid profile", () => {
    expect(validateProfile(valid)).toEqual({});
  });

  it("requires name and email", () => {
    expect(validateProfile({ ...valid, name: " ", email: "" })).toEqual({
      name: "Enter your name",
      email: "Enter your email",
    });
  });

  it("limits name to 40 characters", () => {
    expect(validateProfile({ ...valid, name: "x".repeat(41) }).name).toBe("Keep your name under 40 characters");
  });

  it.each(["alice", "alice@example", "a b@example.com", "@example.com"])("rejects the email %s", (email) => {
    expect(validateProfile({ ...valid, email }).email).toBe("Enter an email like name@example.com");
  });

  it("allows a 160 character bio and refuses 161", () => {
    expect(validateProfile({ ...valid, bio: "x".repeat(160) })).toEqual({});
    expect(validateProfile({ ...valid, bio: "x".repeat(161) }).bio).toBe("Keep your bio under 160 characters");
  });
});

describe("validatePhoto", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s", (type) => {
    expect(validatePhoto({ type, size: 1000 })).toBeUndefined();
  });

  it("rejects a file that isn't a photo", () => {
    expect(validatePhoto({ type: "application/pdf", size: 1000 })).toBe(
      "That file isn’t a photo. Choose a JPG, PNG or WebP."
    );
  });

  it("allows exactly 2 MB and refuses anything bigger, saying how big it is", () => {
    expect(validatePhoto({ type: "image/png", size: 2097152 })).toBeUndefined();
    expect(validatePhoto({ type: "image/png", size: 3 * 1048576 })).toBe("That photo is 3,0 MB. Choose one under 2 MB.");
  });
});
