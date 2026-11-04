import { z } from "zod";

// The max check must come before int(): zod's int() rejects unsafe values itself with a
// generic message, and only the first issue reaches the user.
export const amountCentsSchema = z.number().positive().max(Number.MAX_SAFE_INTEGER, "That amount is too large").int();
export const nonBlankStringSchema = z.string().trim().min(1, "Can't be blank");
export const emailSchema = z.string().email("Invalid email");
export const expenseDescriptionSchema = nonBlankStringSchema.max(60, "Keep it under 60 characters");
export const groupNameSchema = nonBlankStringSchema.max(40, "Keep the name under 40 characters");
export const userNameSchema = nonBlankStringSchema.max(40, "Keep your name under 40 characters");
export const bioSchema = z.string().max(160, "Keep your bio under 160 characters");
// A 2 MB photo is about 2.8 MB once base64 encoded as a data URL.
export const avatarUrlSchema = z.string().max(3_000_000, "That photo is too big");
