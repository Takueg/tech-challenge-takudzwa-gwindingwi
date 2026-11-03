import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../lib/db.js";

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(({ input }) => {
      const user = Array.from(db.users.values()).find((u) => u.username === input.username);
      if (!user) throw new Error("Unknown username");
      return user;
    }),
});
