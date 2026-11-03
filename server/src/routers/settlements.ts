import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, nextId, type Settlement } from "../lib/db.js";

export const settlementsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        fromUserId: z.string(),
        toUserId: z.string(),
        amountCents: z.number().int().positive(),
      })
    )
    .mutation(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);

      const settlement: Settlement = {
        id: nextId("settlement"),
        groupId: input.groupId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        amountCents: input.amountCents,
        createdAt: new Date().toISOString(),
      };
      db.settlements.set(settlement.id, settlement);
      return settlement;
    }),
});
