import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { amountCentsSchema } from "../lib/schemas.js";
import {
  createSettlement,
  deleteSettlement,
  listDebtsForUser,
  restoreSettlement,
} from "../lib/settlement-service.js";

const settlementInput = z.object({ settlementId: z.string() });

export const settlementsRouter = router({
  suggestedForUser: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => listDebtsForUser(input.userId)),

  create: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        fromUserId: z.string(),
        toUserId: z.string(),
        amountCents: amountCentsSchema,
      })
    )
    .mutation(({ input }) => createSettlement(input)),

  delete: publicProcedure.input(settlementInput).mutation(({ input }) => {
    deleteSettlement(input.settlementId);
    return { ok: true };
  }),

  restore: publicProcedure.input(settlementInput).mutation(({ input }) => restoreSettlement(input.settlementId)),
});
