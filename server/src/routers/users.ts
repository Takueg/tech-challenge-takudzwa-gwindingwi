import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { avatarUrlSchema, bioSchema, emailSchema, userNameSchema } from "../lib/schemas.js";
import { listUsers, updateAvatar, updateUser } from "../lib/user-service.js";

export const usersRouter = router({
  list: publicProcedure.query(() => listUsers()),

  update: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: userNameSchema,
        email: emailSchema,
        bio: bioSchema.optional(),
      })
    )
    .mutation(({ input }) => updateUser(input)),

  updateAvatar: publicProcedure
    .input(z.object({ userId: z.string(), avatarUrl: avatarUrlSchema }))
    .mutation(({ input }) => updateAvatar(input.userId, input.avatarUrl)),
});
