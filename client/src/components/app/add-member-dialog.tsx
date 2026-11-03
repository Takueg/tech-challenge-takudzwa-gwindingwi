import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DialogActions, ErrorBanner } from "@/components/app/form-parts";
import { MemberPicker } from "@/components/app/member-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { errorMessage, isRejection } from "@/lib/error-message";
import { notify } from "@/lib/notify";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { useUndo } from "@/lib/use-undo";

const ALREADY_IN_GROUP = "Everyone you know is already in this group";

export function AddMemberDialog({
  groupId,
  groupName,
  memberIds,
  onClose,
  onAdded,
}: {
  groupId: string;
  groupName: string;
  memberIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  const { data: users } = useQuery(trpc.users.list.queryOptions());
  const [userIds, setUserIds] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(true);
  const [error, setError] = useState("");

  const candidates = (users ?? []).filter((user) => !memberIds.includes(user.id));

  const add = useMutation(
    trpc.groups.addMembers.mutationOptions({
      meta: { handlesError: true },
      onSuccess: () => {
        invalidate();
        onAdded();
        onClose();
        const name = users?.find((user) => user.id === userIds[0])?.name ?? "They";
        notify.success({
          title: `${userIds.length === 1 ? name : `${userIds.length} People`} Joined ${groupName}`,
          body: "They’ll share expenses added from now on.",
          onUndo: () =>
            undo(() => trpcClient.groups.removeMembers.mutate({ groupId, userIds })),
        });
      },
    })
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (add.isPending) return;
    if (userIds.length === 0) {
      setError(candidates.length ? "Choose someone to add" : ALREADY_IN_GROUP);
      return;
    }
    add.mutate({ groupId, userIds });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Add Members"
        subtitle="New members share expenses added after they join."
        onEscapeKeyDown={(event) => {
          if (!listOpen) return;
          event.preventDefault();
          setListOpen(false);
        }}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
          {add.isError && (
            <ErrorBanner title="We couldn’t add these members">
              {isRejection(add.error)
                ? errorMessage(add.error)
                : "Nothing was changed. Your choices are still here, so you can try again."}
            </ErrorBanner>
          )}
          <MemberPicker
            label="People"
            people={candidates}
            selected={userIds}
            onChange={(ids) => {
              setUserIds(ids);
              if (ids.length > 0) setError("");
            }}
            open={listOpen}
            onOpenChange={setListOpen}
            error={error}
            noPeopleMessage={ALREADY_IN_GROUP}
          />
          <DialogActions
            submitLabel={add.isPending ? "Adding…" : add.isError ? "Try Again" : userIds.length > 1 ? "Add Members" : "Add Member"}
            pending={add.isPending}
            onCancel={onClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
