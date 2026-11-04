import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DialogActions, SaveErrorBanner, TextField } from "@/components/app/form-parts";
import { MemberPicker } from "@/components/app/member-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCurrentUserId } from "@/context/current-user";
import { useMyArchivedGroups, useMyGroups, useUsers } from "@/hooks/use-data";
import { notify } from "@/lib/notify";
import { useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { validateGroupName } from "@/lib/validation";

export function NewGroupDialog({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const invalidate = useInvalidateExpenseData();
  const currentUserId = useCurrentUserId();
  const { data: users } = useUsers();
  const { data: groups } = useMyGroups();
  const { data: archived } = useMyArchivedGroups();

  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [membersError, setMembersError] = useState<string>();

  const people = (users ?? []).filter((user) => user.id !== currentUserId);
  const myGroupNames = [...(groups ?? []), ...(archived ?? [])].map((group) => group.name);

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
    if (create.isPending) return;
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
            <SaveErrorBanner error={create.error} title="We couldn’t create this group" />
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
