import { type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { DialogActions, SaveErrorBanner, FieldError, FormSummary, TextField } from "@/components/app/form-parts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCurrentUserId } from "@/context/current-user";
import { useMyGroups } from "@/hooks/use-data";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { formatCents } from "@/lib/format";
import { notify } from "@/lib/notify";
import { parseAmount } from "@/lib/parse-amount";
import { splitSentence } from "@/lib/split-preview";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { useUndo } from "@/lib/use-undo";
import { validateDescription, type FieldErrors } from "@/lib/validation";

type Values = { groupId: string; description: string; amount: string };
type Errors = FieldErrors<keyof Values>;

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.groupId) errors.groupId = "Choose a group";
  const description = validateDescription(values.description);
  if (description) errors.description = description;
  const { error } = parseAmount(values.amount);
  if (error) errors.amount = error;
  return errors;
}

/** Add Expense from the dashboard: the current user is the payer, and they choose the group. */
export function AddExpenseDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (expenseId: string) => void;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  const currentUserId = useCurrentUserId();
  const { data } = useMyGroups();
  const myGroups = data ?? [];

  const { values, errors, summary, update, check } = useValidatedForm<Values, keyof Values>(
    {
      groupId: "",
      description: "",
      amount: "",
    },
    validate,
    "add this expense"
  );

  const selected = myGroups.find((group) => group.id === values.groupId);
  const amountCents = parseAmount(values.amount).cents;
  const { data: splits } = useQuery({
    ...trpc.expenses.previewSplit.queryOptions({ groupId: values.groupId, amountCents: amountCents ?? 1 }),
    enabled: Boolean(selected && amountCents),
    placeholderData: keepPreviousData,
  });

  const create = useMutation(
    trpc.expenses.create.mutationOptions({
      meta: { handlesError: true },
      onSuccess: (expense) => {
        invalidate();
        onAdded(expense.id);
        onClose();
        notify.success({
          title: "Expense Added",
          body: `“${expense.description}” · ${formatCents(expense.amountCents)} in ${selected?.name}. Everyone’s balance is updated.`,
          onUndo: () =>
            undo(() => trpcClient.expenses.delete.mutate({ expenseId: expense.id, userId: expense.paidByUserId }), {
              title: "Expense Removed",
              body: `“${expense.description}” was taken out of ${selected?.name}.`,
            }),
        });
      },
    })
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    if (!check()) return;
    create.mutate({
      groupId: values.groupId,
      description: values.description.trim(),
      amountCents: amountCents as number,
      paidByUserId: currentUserId,
    });
  }

  const preview = !selected
    ? "Choose a group to see how it splits."
    : !amountCents || !splits?.length
      ? `Split equally between ${selected.memberIds.length} members of ${selected.name}.`
      : splitSentence(splits, amountCents, currentUserId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Add Expense" subtitle="You’re the payer. It’s split equally with the group.">
        <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
          {create.isError && (
            <SaveErrorBanner error={create.error} title="We couldn’t save this expense" />
          )}
          <div className="flex flex-col gap-2">
            <Label id="qa-group-label">Group</Label>
            <Select
              aria-labelledby="qa-group-label"
              aria-describedby={errors.groupId ? "qa-group-err" : undefined}
              options={myGroups.map((group) => ({ value: group.id, label: group.name }))}
              placeholder="Choose a group"
              value={values.groupId}
              onValueChange={(groupId) => update({ groupId })}
              invalid={Boolean(errors.groupId)}
            />
            {errors.groupId && <FieldError id="qa-group-err">{errors.groupId}</FieldError>}
          </div>
          <TextField
            id="qa-desc"
            label="What Was It?"
            placeholder="Pizza night, taxi, tickets…"
            autoFocus
            value={values.description}
            onChange={(event) => update({ description: event.target.value })}
            error={errors.description}
          />
          <TextField
            id="qa-amount"
            label="Amount"
            placeholder="0,00"
            inputMode="decimal"
            suffix="€"
            value={values.amount}
            onChange={(event) => update({ amount: event.target.value })}
            error={errors.amount}
          />
          <div aria-live="polite" className="rounded-[18px] bg-sheet px-[18px] py-3.5 type-p400-14-20">
            {preview}
          </div>
          <FormSummary>{summary}</FormSummary>
          <DialogActions
            submitLabel={create.isPending ? "Adding…" : create.isError ? "Try Again" : "Add Expense"}
            pending={create.isPending}
            onCancel={onClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
