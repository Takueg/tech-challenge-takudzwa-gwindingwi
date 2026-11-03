import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, nextId, toPublicUser, type Group } from "../lib/db.js";
import { computeNetBalances, simplifyDebts } from "../lib/balances.js";
import { archiveGroup, unarchiveGroup } from "../lib/group-service.js";
import { nonBlankStringSchema } from "../lib/schemas.js";

function listGroupsWithTotals(includeGroup: (group: Group) => boolean) {
  return Array.from(db.groups.values())
    .filter(includeGroup)
    .map((group) => {
      let expenseCount = 0;
      let totalCents = 0;
      for (const expense of db.expenses.values()) {
        if (expense.groupId !== group.id) continue;
        expenseCount += 1;
        totalCents += expense.amountCents;
      }
      return { ...group, expenseCount, totalCents };
    });
}

export const groupsRouter = router({
  list: publicProcedure.query(() => listGroupsWithTotals((group) => !group.archivedAt)),

  listArchived: publicProcedure.query(() => listGroupsWithTotals((group) => Boolean(group.archivedAt))),

  archive: publicProcedure.input(z.object({ groupId: z.string() })).mutation(({ input }) => archiveGroup(input.groupId)),

  unarchive: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(({ input }) => unarchiveGroup(input.groupId)),

  create: publicProcedure
    .input(
      z.object({
        name: nonBlankStringSchema,
        memberIds: z.array(z.string()).min(1),
      })
    )
    .mutation(({ input }) => {
      const memberIds = [...new Set(input.memberIds)];
      for (const userId of memberIds) {
        if (!db.users.has(userId)) throw new Error(`User ${userId} not found`);
      }

      const group: Group = {
        id: nextId("group"),
        name: input.name,
        memberIds,
        createdAt: new Date().toISOString(),
      };
      db.groups.set(group.id, group);
      db.groupExpenseCache.set(group.id, []);
      return group;
    }),

  addMember: publicProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);
      if (!db.users.has(input.userId)) throw new Error(`User ${input.userId} not found`);
      if (!group.memberIds.includes(input.userId)) {
        group.memberIds.push(input.userId);
      }
      return group;
    }),

  removeMember: publicProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw new Error(`Group ${input.groupId} not found`);
      const balance = computeNetBalances(group.id).find((b) => b.userId === input.userId);
      if (balance && balance.netCents !== 0) {
        throw new Error("This member still has an outstanding balance. Settle up before removing them.");
      }
      group.memberIds = group.memberIds.filter((id) => id !== input.userId);
      return group;
    }),

  delete: publicProcedure.input(z.object({ groupId: z.string() })).mutation(({ input }) => {
    const group = db.groups.get(input.groupId);
    if (!group) throw new Error(`Group ${input.groupId} not found`);
    db.groups.delete(input.groupId);
    db.groupExpenseCache.delete(input.groupId);
    for (const expense of db.expenses.values()) {
      if (expense.groupId === input.groupId) db.expenses.delete(expense.id);
    }
    for (const settlement of db.settlements.values()) {
      if (settlement.groupId === input.groupId) db.settlements.delete(settlement.id);
    }
    return { ok: true };
  }),

  detail: publicProcedure.input(z.object({ groupId: z.string() })).query(({ input }) => {
    const group = db.groups.get(input.groupId);
    if (!group) throw new Error(`Group ${input.groupId} not found`);

    const members = group.memberIds
      .map((id) => db.users.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map(toPublicUser);

    // Read from the per-group cache rather than scanning every expense.
    const expenses = (db.groupExpenseCache.get(group.id) ?? [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const settlements = Array.from(db.settlements.values())
      .filter((s) => s.groupId === group.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Category totals, computed straight from the source of truth (not the cache above).
    const categoryTotals: Record<string, number> = {};
    for (const expense of db.expenses.values()) {
      if (expense.groupId !== group.id) continue;
      categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + expense.amountCents;
    }

    const balances = computeNetBalances(group.id);
    const suggestedTransfers = simplifyDebts(balances);

    return { group, members, expenses, settlements, balances, suggestedTransfers, categoryTotals };
  }),
});
