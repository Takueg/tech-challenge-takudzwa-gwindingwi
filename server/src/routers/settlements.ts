import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { computeNetBalances } from "../lib/balances.js";
import { db, nextId, type Settlement } from "../lib/db.js";
import { amountCentsSchema } from "../lib/schemas.js";

export const settlementsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        fromUserId: z.string(),
        toUserId: z.string(),
        amountCents: amountCentsSchema,
      })
    )
    .mutation(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);
      if (group.archivedAt) throw new Error("Can't record a settlement in an archived group");
      if (input.fromUserId === input.toUserId) throw new Error("Payer and receiver must be different people");

      // Balances list every member plus any former member still owed or owing,
      // so a former member's debt can still be settled.
      const balances = computeNetBalances(input.groupId);
      for (const userId of [input.fromUserId, input.toUserId]) {
        if (!balances.some((b) => b.userId === userId)) {
          throw new Error("Payer and receiver must be part of the group");
        }
      }

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
