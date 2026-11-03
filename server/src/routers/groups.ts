import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db, nextId, toPublicUser, type Expense, type Group, type Settlement } from "../lib/db.js";
import { computeNetBalances, simplifyDebts } from "../lib/balances.js";
import { archiveGroup, deleteGroup, unarchiveGroup } from "../lib/group-service.js";
import { nonBlankStringSchema } from "../lib/schemas.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";

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

/** People on this group's history who have since left. Name only, since the UI just needs to label them. */
function listFormerMembers(group: Group, expenses: Expense[], settlements: Settlement[]) {
  const involvedIds = new Set([
    ...expenses.flatMap((e) => [e.paidByUserId, ...e.splits.map((s) => s.userId)]),
    ...settlements.flatMap((s) => [s.fromUserId, s.toUserId]),
  ]);
  return Array.from(involvedIds)
    .filter((id) => !group.memberIds.includes(id))
    .map((id) => db.users.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map(({ id, name }) => ({ id, name }));
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
        if (!db.users.has(userId)) throw notFound(`User ${userId} not found`);
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
      if (!group) throw notFound(`Group ${input.groupId} not found`);
      if (!db.users.has(input.userId)) throw notFound(`User ${input.userId} not found`);
      if (!group.memberIds.includes(input.userId)) {
        group.memberIds.push(input.userId);
      }
      return group;
    }),

  removeMember: publicProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(({ input }) => {
      const group = db.groups.get(input.groupId);
      if (!group) throw notFound(`Group ${input.groupId} not found`);
      if (!group.memberIds.includes(input.userId)) throw badRequest("That person isn't a member of this group");
      if (group.memberIds.length === 1) throw conflict("Can't remove the last member of a group");
      const balance = computeNetBalances(group.id).find((b) => b.userId === input.userId);
      if (balance && balance.netCents !== 0) {
        throw conflict("This member still has an outstanding balance. Settle up before removing them.");
      }
      group.memberIds = group.memberIds.filter((id) => id !== input.userId);
      return group;
    }),

  delete: publicProcedure.input(z.object({ groupId: z.string() })).mutation(({ input }) => {
    deleteGroup(input.groupId);
    return { ok: true };
  }),

  detail: publicProcedure.input(z.object({ groupId: z.string() })).query(({ input }) => {
    const group = db.groups.get(input.groupId);
    if (!group) throw notFound(`Group ${input.groupId} not found`);

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

    const formerMembers = listFormerMembers(group, expenses, settlements);

    return { group, members, formerMembers, expenses, settlements, balances, suggestedTransfers, categoryTotals };
  }),
});
