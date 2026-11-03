import { z } from "zod";

export const amountCentsSchema = z.number().int().positive().safe();
export const nonBlankStringSchema = z.string().trim().min(1);
