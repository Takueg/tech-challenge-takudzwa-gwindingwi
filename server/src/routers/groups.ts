import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import {
  addMembers,
  archiveGroup,
  createGroup,
  deleteGroup,
  getGroupDetail,
  listArchivedGroupSummaries,
  listGroupSummaries,
  removeMembers,
  unarchiveGroup,
} from "../lib/group-service.js";
import { nonBlankStringSchema } from "../lib/schemas.js";

const MAX_MEMBERS_PER_REQUEST = 200;
const userInput = z.object({ userId: z.string() });
const groupInput = z.object({ groupId: z.string() });
const membersInput = groupInput.extend({ userIds: z.array(z.string()).min(1).max(MAX_MEMBERS_PER_REQUEST) });

export const groupsRouter = router({
  list: publicProcedure.input(userInput).query(({ input }) => listGroupSummaries(input.userId)),
  listArchived: publicProcedure.input(userInput).query(({ input }) => listArchivedGroupSummaries(input.userId)),

  detail: publicProcedure
    .input(groupInput.extend({ userId: z.string() }))
    .query(({ input }) => getGroupDetail(input.groupId, input.userId)),

  create: publicProcedure
    .input(z.object({ name: nonBlankStringSchema, memberIds: z.array(z.string()).min(1) }))
    .mutation(({ input }) => createGroup(input)),

  addMembers: publicProcedure.input(membersInput).mutation(({ input }) => addMembers(input.groupId, input.userIds)),
  removeMembers: publicProcedure
    .input(membersInput)
    .mutation(({ input }) => removeMembers(input.groupId, input.userIds)),

  archive: publicProcedure.input(groupInput).mutation(({ input }) => archiveGroup(input.groupId)),
  unarchive: publicProcedure.input(groupInput).mutation(({ input }) => unarchiveGroup(input.groupId)),

  delete: publicProcedure.input(groupInput).mutation(({ input }) => {
    deleteGroup(input.groupId);
    return { ok: true };
  }),
});
