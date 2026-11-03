import { useEffect, useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { DialogActions, ErrorBanner, FieldError, FormSummary } from "@/components/app/form-parts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCurrentUser } from "@/context/current-user";
import { errorMessage, isRejection } from "@/lib/error-message";
import { centsToInput, formatCents } from "@/lib/format";
import { notify } from "@/lib/notify";
import { parseAmount } from "@/lib/parse-amount";
import { roundingNote } from "@/lib/split-preview";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { useUndo } from "@/lib/use-undo";
import { errorSummary, hasErrors, revalidate, validateDescription, type FieldErrors } from "@/lib/validation";

type Values = { description: string; amount: string; payerId: string };
type Errors = FieldErrors<keyof Values>;

type EditableExpense = { id: string; description: string; amountCents: number; paidByUserId: string };
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
  expense,
  onClose,
  onSaved,
}: {
  groupId: string;
  groupName: string;
  members: Person[];
  expense?: EditableExpense;
  onClose: () => void;
  onSaved: (expenseId: string) => void;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  const { currentUserId } = useCurrentUser();
  const editing = Boolean(expense);

  const [values, setValues] = useState<Values>({
    description: expense?.description ?? "",
    amount: expense ? centsToInput(expense.amountCents) : "",
    payerId: expense?.paidByUserId ?? (members.some((m) => m.id === currentUserId) ? (currentUserId as string) : ""),
  });
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState("");

  function update(patch: Partial<Values>) {
    const next = { ...values, ...patch };
    setValues(next);
    if (!hasErrors(errors)) return;
    const kept = revalidate(errors, validate(next));
    setErrors(kept);
    if (!hasErrors(kept)) setSummary("");
  }

  const description = values.description.trim();
  const debouncedDescription = useDebounced(description, 300);
  const { data: category } = useQuery({
    ...trpc.expenses.detectCategory.queryOptions({ description: debouncedDescription }),
    enabled: Boolean(debouncedDescription),
    placeholderData: keepPreviousData,
  });

  const amountCents = parseAmount(values.amount).cents;
  const { data: splits } = useQuery({
    ...trpc.expenses.previewSplit.queryOptions({ groupId, amountCents: amountCents ?? 1 }),
    enabled: Boolean(amountCents),
    placeholderData: keepPreviousData,
  });
  const nameOf = (userId: string) => {
    if (userId === currentUserId) return "You";
    return members.find((member) => member.id === userId)?.name ?? "Former member";
  };

  const onFailure = { meta: { handlesError: true } };
  const create = useMutation(
    trpc.expenses.create.mutationOptions({
      ...onFailure,
      onSuccess: (created) => {
        invalidate();
        onSaved(created.id);
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
        onSaved(updated.id);
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
    const found = validate(values);
    setErrors(found);
    setSummary(errorSummary(found, "continue"));
    if (hasErrors(found)) return;
    const fields = { description, amountCents: amountCents as number, paidByUserId: values.payerId };
    if (expense) save.mutate({ expenseId: expense.id, userId: expense.paidByUserId, ...fields });
    else create.mutate({ groupId, ...fields });
  }

  const payerOptions = members.map((member) => ({
    value: member.id,
    label: member.id === currentUserId ? `${member.name} (You)` : member.name,
  }));
  const idleLabel = editing ? "Save Changes" : "Add Expense";
  const pendingLabel = editing ? "Saving…" : "Adding…";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={editing ? "Edit Expense" : "Add Expense"}
        subtitle={`${groupName} · split equally between ${members.length} members`}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
          {failure && (
            <ErrorBanner title="We couldn’t save this expense">
              {isRejection(failure)
                ? errorMessage(failure)
                : "Nothing was changed. Your details are still here, so you can try again."}
            </ErrorBanner>
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
