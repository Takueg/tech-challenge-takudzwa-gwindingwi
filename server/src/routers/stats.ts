import { z } from "zod";
import { publicProcedure, router } from "../trpc.js";
import { getBalancesForUser, getLeaderboard, getOverview } from "../lib/stats-service.js";

const userInput = z.object({ userId: z.string() });

export const statsRouter = router({
  overview: publicProcedure.input(userInput).query(({ input }) => getOverview(input.userId)),
  myBalances: publicProcedure.input(userInput).query(({ input }) => getBalancesForUser(input.userId)),
  leaderboard: publicProcedure.input(userInput).query(({ input }) => getLeaderboard(input.userId)),
});
