import { useEffect, useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { DialogActions, SaveErrorBanner, FieldError, FormSummary } from "@/components/app/form-parts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCurrentUserId } from "@/context/current-user";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { centsToInput, formatCents } from "@/lib/format";
import { notify } from "@/lib/notify";
import { parseAmount } from "@/lib/parse-amount";
import { roundingNote } from "@/lib/split-preview";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { useUndo } from "@/lib/use-undo";
import { validateDescription, type FieldErrors } from "@/lib/validation";

type Values = { description: string; amount: string; payerId: string };
type Errors = FieldErrors<keyof Values>;

type EditableExpense = {
  id: string;
  description: string;
  amountCents: number;
  paidByUserId: string;
  splits: { userId: string }[];
};
type Person = { id: string; name: string };

function validate(values: Values): Errors {
  const errors: Errors = {};
  const description = validateDescription(values.description);
  if (description) errors.description = description;
  const { error } = parseAmount(values.amount);
  if (error) errors.amount = error;
  if (!values.payerId) errors.payerId = "Choose who paid";
  return errors;
}

/** Waits for typing to pause before asking the server what category a description gets. */
function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Add or edit an expense from a group page. */
export function ExpenseFormDialog({
  groupId,
  groupName,
  members,
  people,
  expense,
  onClose,
  onAdded,
}: {
  groupId: string;
  groupName: string;
  members: Person[];
  /** Members plus former members, who can still be on an existing expense. */
  people: Person[];
  expense?: EditableExpense;
  onClose: () => void;
  onAdded: (expenseId: string) => void;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  const currentUserId = useCurrentUserId();
  const editing = Boolean(expense);

  const { values, errors, summary, update, check } = useValidatedForm<Values, keyof Values>(
    {
      description: expense?.description ?? "",
      amount: expense ? centsToInput(expense.amountCents) : "",
      payerId: expense?.paidByUserId ?? (members.some((m) => m.id === currentUserId) ? currentUserId : ""),
    },
    validate,
    "continue"
  );

  const description = values.description.trim();
  const debouncedDescription = useDebounced(description, 300);
  const { data: category } = useQuery({
    ...trpc.expenses.detectCategory.queryOptions({ description: debouncedDescription }),
    enabled: Boolean(debouncedDescription),
    placeholderData: keepPreviousData,
  });

  const amountCents = parseAmount(values.amount).cents;
  const { data: splits } = useQuery({
    ...trpc.expenses.previewSplit.queryOptions({ groupId, amountCents: amountCents ?? 1, expenseId: expense?.id }),
    enabled: Boolean(amountCents),
    placeholderData: keepPreviousData,
  });
  const nameOf = (userId: string) => {
    if (userId === currentUserId) return "You";
    return people.find((person) => person.id === userId)?.name ?? "Former member";
  };

  const onFailure = { meta: { handlesError: true } };
  const create = useMutation(
    trpc.expenses.create.mutationOptions({
      ...onFailure,
      onSuccess: (created) => {
        invalidate();
        onAdded(created.id);
        onClose();
        const payer = created.paidByUserId === currentUserId ? "you" : created.paidByUserName;
        notify.success({
          title: "Expense Added",
          body: `“${created.description}” · ${formatCents(created.amountCents)}, paid by ${payer}.`,
          // Only the payer can delete, so there's no undo when you record it for someone else.
          onUndo:
            created.paidByUserId === currentUserId
              ? () =>
                  undo(() => trpcClient.expenses.delete.mutate({ expenseId: created.id, userId: created.paidByUserId }), {
                    title: "Expense Removed",
                    body: `“${created.description}” was taken out.`,
                  })
              : undefined,
        });
      },
    })
  );
  const save = useMutation(
    trpc.expenses.update.mutationOptions({
      ...onFailure,
      onSuccess: (updated) => {
        invalidate();
        onClose();
        const before = expense as EditableExpense;
        notify.success({
          title: "Changes Saved",
          body: `“${updated.description}” is now ${formatCents(updated.amountCents)}. Balances are updated.`,
          // Handing the expense to another payer also hands them the right to change it back.
          onUndo:
            updated.paidByUserId === currentUserId
              ? () =>
                  undo(() =>
                    trpcClient.expenses.update.mutate({
                      expenseId: before.id,
                      description: before.description,
                      amountCents: before.amountCents,
                      paidByUserId: before.paidByUserId,
                      userId: updated.paidByUserId,
                    })
                  )
              : undefined,
        });
      },
    })
  );
  const pending = create.isPending || save.isPending;
  const failure = create.error ?? save.error;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!check()) return;
    const fields = { description, amountCents: amountCents as number, paidByUserId: values.payerId };
    if (expense) save.mutate({ expenseId: expense.id, userId: expense.paidByUserId, ...fields });
    else create.mutate({ groupId, ...fields });
  }

  const payers = expense
    ? people.filter(
        (person) =>
          members.some((member) => member.id === person.id) ||
          person.id === expense.paidByUserId ||
          expense.splits.some((split) => split.userId === person.id)
      )
    : members;
  const payerOptions = payers.map((member) => ({
    value: member.id,
    label: member.id === currentUserId ? `${member.name} (You)` : member.name,
  }));
  const idleLabel = editing ? "Save Changes" : "Add Expense";
  const pendingLabel = editing ? "Saving…" : "Adding…";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={editing ? "Edit Expense" : "Add Expense"}
        subtitle={`${groupName} · split equally between ${expense?.splits.length ?? members.length} members`}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
          {failure && (
            <SaveErrorBanner error={failure} title="We couldn’t save this expense" />
          )}
          <div className="swl-field">
            <Label htmlFor="ae-desc">Description</Label>
            <Input
              id="ae-desc"
              placeholder="Dinner, tickets, taxi…"
              autoFocus
              autoComplete="off"
              aria-describedby="ae-desc-msg"
              invalid={Boolean(errors.description)}
              value={values.description}
              onChange={(event) => update({ description: event.target.value })}
            />
            <div id="ae-desc-msg" className="flex justify-between gap-3">
              {errors.description ? (
                <FieldError>{errors.description}</FieldError>
              ) : (
                <span className="app-hint">
                  {description && category
                    ? `Category: ${category} (detected)`
                    : "We’ll pick a category from the description"}
                </span>
              )}
              <span className="pr-4 [font:400_12px/18px_var(--font-poppins)] text-muted-foreground">
                {description.length}/60
              </span>
            </div>
          </div>
          <div className="swl-field">
            <Label htmlFor="ae-amount">Amount</Label>
            <Input
              id="ae-amount"
              placeholder="0,00"
              inputMode="decimal"
              autoComplete="off"
              suffix="€"
              aria-describedby={errors.amount ? "ae-amount-err" : undefined}
              invalid={Boolean(errors.amount)}
              value={values.amount}
              onChange={(event) => update({ amount: event.target.value })}
            />
            {errors.amount && <FieldError id="ae-amount-err">{errors.amount}</FieldError>}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label id="ae-payer-label">Paid By</Label>
            <Select
              aria-labelledby="ae-payer-label"
              options={payerOptions}
              placeholder="Who paid?"
              value={values.payerId}
              onValueChange={(payerId) => update({ payerId })}
              invalid={Boolean(errors.payerId)}
            />
            {errors.payerId && <FieldError>{errors.payerId}</FieldError>}
          </div>
          <div aria-live="polite" className="flex flex-col gap-2.5 rounded-[18px] bg-sheet px-[18px] py-4">
            <span className="[font:500_13px/1_var(--font-poppins)] text-muted-foreground">Each Person’s Share</span>
            {amountCents && splits?.length ? (
              <>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {splits.map((split) => (
                    <li key={split.userId} className="flex justify-between [font:400_14px/20px_var(--font-poppins)]">
                      <span>{nameOf(split.userId)}</span>
                      <span className="font-semibold">{formatCents(split.amountCents)}</span>
                    </li>
                  ))}
                </ul>
                <span className="[font:400_12px/16px_var(--font-poppins)] text-muted-foreground">
                  {roundingNote(splits)}
                </span>
              </>
            ) : (
              <span className="[font:400_14px/20px_var(--font-spartan)] text-muted-foreground">
                Enter an amount to see the split.
              </span>
            )}
          </div>
          <FormSummary>{summary}</FormSummary>
          <DialogActions
            submitLabel={pending ? pendingLabel : failure ? "Try Again" : idleLabel}
            pending={pending}
            onCancel={onClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
