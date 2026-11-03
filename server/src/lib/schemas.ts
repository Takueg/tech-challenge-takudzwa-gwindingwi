import { z } from "zod";

// The max check must come before int(): zod's int() rejects unsafe values itself with a
// generic message, and only the first issue reaches the user.
export const amountCentsSchema = z.number().positive().max(Number.MAX_SAFE_INTEGER, "That amount is too large").int();
export const nonBlankStringSchema = z.string().trim().min(1, "Can't be blank");
export const emailSchema = z.string().email("Invalid email");
