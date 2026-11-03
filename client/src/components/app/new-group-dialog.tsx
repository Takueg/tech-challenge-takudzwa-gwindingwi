import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DialogActions, ErrorBanner, TextField } from "@/components/app/form-parts";
import { MemberPicker } from "@/components/app/member-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCurrentUser } from "@/context/current-user";
import { errorMessage, isRejection } from "@/lib/error-message";
import { notify } from "@/lib/notify";
import { useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { validateGroupName } from "@/lib/validation";

export function NewGroupDialog({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const invalidate = useInvalidateExpenseData();
  const { currentUserId } = useCurrentUser();
  const { data: users } = useQuery(trpc.users.list.queryOptions());
  const { data: groups } = useQuery(trpc.groups.list.queryOptions());
  const { data: archived } = useQuery(trpc.groups.listArchived.queryOptions());

  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [membersError, setMembersError] = useState<string>();

  const people = (users ?? []).filter((user) => user.id !== currentUserId);
  const myGroupNames = [...(groups ?? []), ...(archived ?? [])]
    .filter((group) => currentUserId && group.memberIds.includes(currentUserId))
    .map((group) => group.name);

  const create = useMutation(
    trpc.groups.create.mutationOptions({
      meta: { handlesError: true },
      onSuccess: (group) => {
        invalidate();
        onClose();
        notify.success({
          title: "Group Created",
          body: `“${group.name}” is ready. Add its first expense.`,
        });
        navigate(`/groups/${group.id}`);
      },
    })
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (create.isPending || !currentUserId) return;
    const foundName = validateGroupName(name, myGroupNames);
    const foundMembers = members.length === 0 ? "Pick at least one person to split with" : undefined;
    setNameError(foundName);
    setMembersError(foundMembers);
    if (foundName || foundMembers) return;
    create.mutate({ name: name.trim(), memberIds: [currentUserId, ...members] });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        width={460}
        title="New Group"
        subtitle="You’re added automatically. Pick who you’re splitting with."
        onEscapeKeyDown={(event) => {
          if (!listOpen) return;
          event.preventDefault();
          setListOpen(false);
        }}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          {create.isError && (
            <ErrorBanner title="We couldn’t create this group">
              {isRejection(create.error)
                ? errorMessage(create.error)
                : "Nothing was changed. Your details are still here, so you can try again."}
            </ErrorBanner>
          )}
          <TextField
            id="ng-name"
            label="Group Name"
            placeholder="Ski trip, Apartment 4B…"
            autoFocus
            maxLength={60}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(validateGroupName(event.target.value, myGroupNames));
            }}
            error={nameError}
          />
          <MemberPicker
            label="Members"
            people={people}
            selected={members}
            onChange={(ids) => {
              setMembers(ids);
              if (ids.length > 0) setMembersError(undefined);
            }}
            open={listOpen}
            onOpenChange={setListOpen}
            error={membersError}
          />
          <div className="pt-1">
            <DialogActions
              submitLabel={create.isPending ? "Creating…" : create.isError ? "Try Again" : "Create Group"}
              pending={create.isPending}
              onCancel={onClose}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
