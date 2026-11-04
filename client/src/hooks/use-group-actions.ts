import { useMutation } from "@tanstack/react-query";
import { useCurrentUserId } from "@/context/current-user";
import { formatCents } from "@/lib/format";
import { notify } from "@/lib/notify";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { useUndo } from "@/lib/use-undo";

export function useArchiveGroup() {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  return useMutation(
    trpc.groups.archive.mutationOptions({
      meta: { errorTitle: "Couldn’t Archive Group" },
      onSuccess: (group) => {
        invalidate();
        notify.success({
          title: "Group Archived",
          body: `${group.name} is hidden from your dashboard.`,
          onUndo: () => undo(() => trpcClient.groups.unarchive.mutate({ groupId: group.id })),
        });
      },
    })
  );
}

export function useUnarchiveGroup() {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  return useMutation(
    trpc.groups.unarchive.mutationOptions({
      meta: { errorTitle: "Couldn’t Unarchive Group" },
      onSuccess: (group) => {
        invalidate();
        notify.success({ title: "Group Unarchived", body: `${group.name} is back on your dashboard.` });
      },
    })
  );
}

export function useDeleteGroup(groupName: string, onDeleted: () => void) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  return useMutation(
    trpc.groups.delete.mutationOptions({
      meta: { errorTitle: "Couldn’t Delete Group" },
      onSuccess: () => {
        onDeleted();
        invalidate();
        notify.info({ title: "Group Deleted", body: `${groupName} and its history were deleted.` });
      },
    })
  );
}

export function useRemoveMember(groupName: string, nameOf: (userId: string) => string) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  return useMutation(
    trpc.groups.removeMembers.mutationOptions({
      meta: { errorTitle: "Couldn’t Remove Member" },
      onSuccess: (group, { userIds }) => {
        invalidate();
        const name = nameOf(userIds[0]);
        notify.success({
          title: `${name} Removed`,
          body: `${name} no longer shares new expenses in ${groupName}.`,
          onUndo: () => undo(() => trpcClient.groups.addMembers.mutate({ groupId: group.id, userIds })),
        });
      },
    })
  );
}

export function useDeleteExpense(descriptionOf: (expenseId: string) => string | undefined) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  const userId = useCurrentUserId();
  return useMutation(
    trpc.expenses.delete.mutationOptions({
      meta: { errorTitle: "Couldn’t Delete Expense" },
      onSuccess: (_result, { expenseId }) => {
        invalidate();
        notify.success({
          title: "Expense Deleted",
          body: `“${descriptionOf(expenseId)}” was removed and balances updated.`,
          onUndo: () => undo(() => trpcClient.expenses.restore.mutate({ expenseId, userId })),
        });
      },
    })
  );
}

export function useRecordPayment(nameOf: (userId: string) => string) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  return useMutation(
    trpc.settlements.create.mutationOptions({
      meta: { errorTitle: "Couldn’t Record Payment" },
      onSuccess: (settlement) => {
        invalidate();
        notify.success({
          title: "Payment Recorded",
          body: `${nameOf(settlement.fromUserId)} paid ${nameOf(settlement.toUserId)} ${formatCents(settlement.amountCents)}.`,
          onUndo: () => undo(() => trpcClient.settlements.delete.mutate({ settlementId: settlement.id })),
        });
      },
    })
  );
}

export function useDeletePayment() {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  return useMutation(
    trpc.settlements.delete.mutationOptions({
      meta: { errorTitle: "Couldn’t Delete Payment" },
      onSuccess: (_result, { settlementId }) => {
        invalidate();
        notify.success({
          title: "Payment Deleted",
          body: "The debt is back on the balances.",
          onUndo: () => undo(() => trpcClient.settlements.restore.mutate({ settlementId })),
        });
      },
    })
  );
}
