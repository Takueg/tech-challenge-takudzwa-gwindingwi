import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DialogActions, ErrorBanner, FieldError, TextField } from "@/components/app/form-parts";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/context/current-user";
import { errorMessage, isRejection } from "@/lib/error-message";
import { notify } from "@/lib/notify";
import { useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { validateGroupName } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string };

/** Searchable multi-select. Its parent owns `open`, so Esc can close the list without closing the dialog. */
function MemberPicker({
  people,
  selected,
  onChange,
  open,
  onOpenChange,
  error,
}: {
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = people.filter((person) => !needle || person.name.toLowerCase().includes(needle));
  const allShownOn = shown.length > 0 && shown.every((person) => selected.includes(person.id));
  const chosen = people.filter((person) => selected.includes(person.id));
  const summary =
    chosen.length === 0
      ? "Choose people"
      : chosen.length === people.length
        ? "Everyone"
        : chosen.map((person) => person.name).join(", ");

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]);

  function toggleAll() {
    const shownIds = shown.map((person) => person.id);
    onChange(
      allShownOn
        ? selected.filter((id) => !shownIds.includes(id))
        : [...new Set([...selected, ...shownIds])]
    );
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (shown.length === 1) toggle(shown[0].id);
  }

  return (
    <div className={cn("app-ms", open && "is-open", error && "app-invalid-ms")}>
      <Label id="ng-mem-label">Members</Label>
      <button
        type="button"
        className="app-ms__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="ng-mem-panel"
        aria-labelledby="ng-mem-label ng-mem-val"
        aria-describedby={error ? "ng-mem-err" : undefined}
        aria-invalid={error ? true : undefined}
        onClick={() => {
          setQuery("");
          onOpenChange(!open);
        }}
      >
        <span id="ng-mem-val" className={cn("app-ms__value", chosen.length === 0 && "app-ms__value--empty")}>
          {summary}
        </span>
        {chosen.length > 0 && (
          <span className="app-ms__count" aria-hidden="true">
            {chosen.length}
          </span>
        )}
        <span className="app-ms__chev" aria-hidden="true">
          <Icon name="expand_more" size={18} />
        </span>
      </button>
      {open && (
        <div id="ng-mem-panel" className="app-ms__panel" role="group" aria-label="Choose members">
          <div className="app-ms__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              className="app-ms__input"
              placeholder="Search people"
              aria-label="Search people"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKey}
            />
          </div>
          {shown.length === 0 ? (
            <p className="app-ms__empty">No one matches “{query.trim()}”</p>
          ) : (
            <>
              <div className="app-ms__opt app-ms__opt--all">
                <Checkbox
                  label={`${needle ? "Select All Matches" : "Select All"} (${shown.length})`}
                  checked={allShownOn}
                  onCheckedChange={toggleAll}
                />
              </div>
              <div className="app-ms__list">
                {shown.map((person) => (
                  <div key={person.id} className="app-ms__opt">
                    <Checkbox
                      label={person.name}
                      checked={selected.includes(person.id)}
                      onCheckedChange={() => toggle(person.id)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="app-ms__foot">
            <span aria-live="polite">
              {chosen.length} of {people.length} selected
            </span>
            {chosen.length > 0 && (
              <button type="button" className="app-ms__clear" onClick={() => onChange([])}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
      {error && <FieldError id="ng-mem-err">{error}</FieldError>}
    </div>
  );
}

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
