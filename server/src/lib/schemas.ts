import { z } from "zod";

export const amountCentsSchema = z.number().int().positive().safe("That amount is too large");
export const nonBlankStringSchema = z.string().trim().min(1, "Can't be blank");
