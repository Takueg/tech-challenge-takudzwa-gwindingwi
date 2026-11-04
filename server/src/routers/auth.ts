import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { logIn } from "../lib/auth-service.js";

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(({ input }) => logIn(input.username, input.password)),
});
