import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, toPublicUser } from "../lib/db.js";

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(({ input }) => {
      const user = Array.from(db.users.values()).find((u) => u.username === input.username);
      // One message for both cases, so login can't be used to discover usernames.
      if (!user || user.password !== input.password) throw new Error("Unknown username or password");
      return toPublicUser(user);
    }),
});
