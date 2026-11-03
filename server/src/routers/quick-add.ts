import { router, publicProcedure } from "../trpc.js";
import { createExpense, createExpenseInput } from "../lib/expense-service.js";

export const quickAddRouter = router({
  create: publicProcedure.input(createExpenseInput).mutation(({ input }) => createExpense(input)),
});
