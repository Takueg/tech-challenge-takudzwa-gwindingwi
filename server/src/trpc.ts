import { initTRPC } from "@trpc/server";
import { ZodError } from "zod";

const t = initTRPC.create({
  // Zod's default message is a JSON array, which ends up in front of users.
  errorFormatter({ shape, error }) {
    if (!(error.cause instanceof ZodError)) return shape;
    const [issue] = error.cause.issues;
    return { ...shape, message: `${issue.path.join(".")}: ${issue.message}` };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
