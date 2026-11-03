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
      const payer = balances.find((b) => b.userId === input.fromUserId);
      const receiver = balances.find((b) => b.userId === input.toUserId);
      if (!payer || !receiver) throw new Error("Payer and receiver must be part of the group");

      if (payer.netCents >= 0) throw new Error("The payer doesn't owe anything");
      if (receiver.netCents <= 0) throw new Error("The receiver isn't owed anything");
      const maxCents = Math.min(-payer.netCents, receiver.netCents);
      if (input.amountCents > maxCents) {
        throw new Error(`That's more than is owed. The most that can be settled here is ${(maxCents / 100).toFixed(2)} EUR.`);
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

  delete: publicProcedure.input(z.object({ settlementId: z.string() })).mutation(({ input }) => {
    const settlement = db.settlements.get(input.settlementId);
    if (!settlement) throw new Error(`Settlement ${input.settlementId} not found`);
    if (db.groups.get(settlement.groupId)?.archivedAt) {
      throw new Error("Can't undo a settlement in an archived group");
    }
    db.settlements.delete(input.settlementId);
    return { ok: true };
  }),
});
