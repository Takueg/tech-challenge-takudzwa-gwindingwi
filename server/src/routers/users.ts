import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { emailSchema, nonBlankStringSchema } from "../lib/schemas.js";
import { listUsers, updateAvatar, updateUser } from "../lib/user-service.js";

export const usersRouter = router({
  list: publicProcedure.query(() => listUsers()),

  update: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: nonBlankStringSchema,
        email: emailSchema,
        bio: z.string().optional(),
      })
    )
    .mutation(({ input }) => updateUser(input)),

  updateAvatar: publicProcedure
    .input(z.object({ userId: z.string(), avatarUrl: z.string() }))
    .mutation(({ input }) => updateAvatar(input.userId, input.avatarUrl)),
});
