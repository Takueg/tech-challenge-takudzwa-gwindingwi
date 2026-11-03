import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, toPublicUser } from "../lib/db.js";
import { emailSchema, nonBlankStringSchema } from "../lib/schemas.js";
import { conflict, notFound } from "../lib/errors.js";

export const usersRouter = router({
  list: publicProcedure.query(() => {
    return Array.from(db.users.values()).map(toPublicUser);
  }),

  update: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: nonBlankStringSchema,
        email: emailSchema,
        bio: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const user = db.users.get(input.userId);
      if (!user) throw notFound(`User ${input.userId} not found`);
      const email = input.email.toLowerCase();
      if (Array.from(db.users.values()).some((u) => u.id !== user.id && u.email.toLowerCase() === email)) {
        throw conflict("That email is already used by another account");
      }
      user.name = input.name;
      user.email = input.email;
      user.bio = input.bio;
      for (const expense of db.expenses.values()) {
        if (expense.paidByUserId === user.id) expense.paidByUserName = user.name;
      }
      return toPublicUser(user);
    }),

  updateAvatar: publicProcedure
    .input(z.object({ userId: z.string(), avatarUrl: z.string() }))
    .mutation(({ input }) => {
      const user = db.users.get(input.userId);
      if (!user) throw notFound(`User ${input.userId} not found`);
      user.avatarUrl = input.avatarUrl;
      return toPublicUser(user);
    }),
});
