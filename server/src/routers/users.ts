import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, nextId, type User } from "../lib/db.js";

export const usersRouter = router({
  list: publicProcedure.query(() => {
    return Array.from(db.users.values());
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(({ input }) => {
      const user: User = {
        id: nextId("user"),
        name: input.name,
        email: input.email,
        username: input.username,
        password: input.password,
      };
      db.users.set(user.id, user);
      return user;
    }),

  update: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1),
        email: z.string().email(),
        bio: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const user = db.users.get(input.userId);
      if (!user) throw new Error(`User ${input.userId} not found`);
      user.name = input.name;
      user.email = input.email;
      user.bio = input.bio;
      for (const expense of db.expenses.values()) {
        if (expense.paidByUserId === user.id) expense.paidByUserName = user.name;
      }
      return user;
    }),

  updateAvatar: publicProcedure
    .input(z.object({ userId: z.string(), avatarUrl: z.string() }))
    .mutation(({ input }) => {
      const user = db.users.get(input.userId);
      if (!user) throw new Error(`User ${input.userId} not found`);
      user.avatarUrl = input.avatarUrl;
      return user;
    }),
});
