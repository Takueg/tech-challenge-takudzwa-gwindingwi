import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, nextId, toPublicUser, type User } from "../lib/db.js";
import { nonBlankStringSchema } from "../lib/schemas.js";
import { conflict, notFound } from "../lib/errors.js";

export const usersRouter = router({
  list: publicProcedure.query(() => {
    return Array.from(db.users.values()).map(toPublicUser);
  }),

  create: publicProcedure
    .input(
      z.object({
        name: nonBlankStringSchema,
        email: z.string().email(),
        username: nonBlankStringSchema,
        password: z.string().min(1),
      })
    )
    .mutation(({ input }) => {
      if (Array.from(db.users.values()).some((u) => u.username === input.username)) {
        throw conflict(`Username ${input.username} is already taken`);
      }

      const user: User = {
        id: nextId("user"),
        name: input.name,
        email: input.email,
        username: input.username,
        password: input.password,
      };
      db.users.set(user.id, user);
      return toPublicUser(user);
    }),

  update: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: nonBlankStringSchema,
        email: z.string().email(),
        bio: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const user = db.users.get(input.userId);
      if (!user) throw notFound(`User ${input.userId} not found`);
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
