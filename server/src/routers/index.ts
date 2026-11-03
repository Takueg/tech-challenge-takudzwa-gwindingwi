import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { usersRouter } from "./users.js";
import { groupsRouter } from "./groups.js";
import { expensesRouter } from "./expenses.js";
import { settlementsRouter } from "./settlements.js";
import { statsRouter } from "./stats.js";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  groups: groupsRouter,
  expenses: expensesRouter,
  settlements: settlementsRouter,
  stats: statsRouter,
});

export type AppRouter = typeof appRouter;
