import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DialogActions, ErrorBanner, FieldError, FormSummary } from "@/components/app/form-parts";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/context/current-user";
import { errorMessage, httpStatusOf } from "@/lib/error-message";
import { centsToInput, formatCents } from "@/lib/format";
import { notify } from "@/lib/notify";
import { parseAmount } from "@/lib/parse-amount";
import { trpcClient, useTRPC, type RouterOutputs } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { useUndo } from "@/lib/use-undo";
import { errorSummary, hasErrors, type FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Debt = RouterOutputs["settlements"]["suggestedForUser"][number];
const keyOf = (debt: Debt) => `${debt.groupId}:${debt.fromUserId}:${debt.toUserId}`;

/** Settle Up from the dashboard: every debt involving you, across groups. */
export function SettleUpDialog({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  const { currentUserId } = useCurrentUser();
  const { data: debts, isLoading } = useQuery(
    trpc.settlements.suggestedForUser.queryOptions({ userId: currentUserId ?? "" })
  );

  const [selectedKey, setSelectedKey] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"selection" | "amount">>({});
  const [summary, setSummary] = useState("");
  const [bannerError, setBannerError] = useState<string | null>(null);

  const selected = debts?.find((debt) => keyOf(debt) === selectedKey);

  const create = useMutation(
    trpc.settlements.create.mutationOptions({
      meta: { handlesError: true },
      onError: (error) => {
        if (httpStatusOf(error) === 409) {
          setErrors({ amount: errorMessage(error) });
          setSummary(errorSummary({ amount: "x" }, "record this payment"));
        } else {
          setBannerError(errorMessage(error));
        }
      },
      onSuccess: (settlement) => {
        invalidate();
        onClose();
        const debt = selected as Debt;
        const who =
          debt.toUserId === currentUserId ? `${debt.fromName} paid you ` : `You paid ${debt.toName} `;
        const left = debt.amountCents - settlement.amountCents;
        notify.success({
          title: "Payment Recorded",
          body: `${who}${formatCents(settlement.amountCents)} in ${debt.groupName}${left > 0 ? `. ${formatCents(left)} is still open.` : ". That’s settled."}`,
          onUndo: () => undo(() => trpcClient.settlements.delete.mutate({ settlementId: settlement.id })),
        });
      },
    })
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    setBannerError(null);
    const found: typeof errors = {};
    if (!selected) found.selection = "Choose who you’re settling up with";
    const parsed = parseAmount(amount);
    if (parsed.error) found.amount = parsed.error;
    else if (selected && (parsed.cents ?? 0) > selected.amountCents) {
      const max = formatCents(selected.amountCents);
      found.amount = `That’s more than the ${max} owed. Enter ${max} or less.`;
    }
    setErrors(found);
    setSummary(errorSummary(found, "record this payment"));
    if (hasErrors(found) || !selected || !parsed.cents) return;
    create.mutate({
      groupId: selected.groupId,
      fromUserId: selected.fromUserId,
      toUserId: selected.toUserId,
      amountCents: parsed.cents,
    });
  }

  function pick(key: string) {
    const debt = debts?.find((candidate) => keyOf(candidate) === key);
    setSelectedKey(key);
    if (debt) setAmount(centsToInput(debt.amountCents));
    setErrors({});
    setSummary("");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        width={520}
        title="Settle Up"
        subtitle="Record a payment you made or received. This doesn’t send money. Pay first, then record it here."
      >
        {isLoading ? (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Loading who you can settle with…</span>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} height={56} radius={14} />
            ))}
          </div>
        ) : !debts?.length ? (
          <EmptyState
            round
            icon="check"
            title="You’re All Settled Up"
            body="Nobody owes you and you don’t owe anyone."
            action={
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            }
          />
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
            {bannerError && <ErrorBanner title="We couldn’t record this payment">{bannerError}</ErrorBanner>}
            <div className="flex flex-col gap-2.5">
              <Label id="su-who">Who Are You Settling With?</Label>
              <RadioGroup
                aria-labelledby="su-who"
                value={selectedKey}
                onValueChange={pick}
                className={cn(
                  "flex max-h-[300px] flex-col gap-1 overflow-y-auto rounded-[18px] bg-sheet p-2",
                  errors.selection && "shadow-[inset_0_0_0_2px_var(--danger)]"
                )}
              >
                {debts.map((debt) => {
                  const iPay = debt.fromUserId === currentUserId;
                  const key = keyOf(debt);
                  return (
                    <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-[14px] px-3 py-2.5">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="swl-radio">
                          <RadioGroupItem value={key} id={key} />
                          <span className="swl-check__label">{iPay ? `You pay ${debt.toName}` : `${debt.fromName} pays you`}</span>
                        </span>
                        <span className="pl-8 [font:400_12px/16px_var(--font-poppins)] text-muted-foreground">
                          {debt.groupName}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex-none [font:600_15px/20px_var(--font-poppins)]",
                          iPay ? "text-accent-ink" : "text-strong"
                        )}
                      >
                        {formatCents(debt.amountCents)}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
              {errors.selection && <FieldError>{errors.selection}</FieldError>}
            </div>
            <div className="swl-field">
              <Label htmlFor="su-amount">Amount Paid</Label>
              <Input
                id="su-amount"
                placeholder="0,00"
                inputMode="decimal"
                autoComplete="off"
                suffix="€"
                aria-describedby="su-amount-msg"
                invalid={Boolean(errors.amount)}
                disabled={create.isPending}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setErrors({ ...errors, amount: undefined });
                  setSummary("");
                }}
              />
              <div id="su-amount-msg">
                {errors.amount ? (
                  <FieldError>{errors.amount}</FieldError>
                ) : (
                  <span className="app-hint">
                    {selected
                      ? `Full amount is ${formatCents(selected.amountCents)}. Enter less to record a partial payment.`
                      : "Pick a payment above and we’ll fill in the amount."}
                  </span>
                )}
              </div>
            </div>
            <FormSummary>{summary}</FormSummary>
            <DialogActions
              submitLabel={create.isPending ? "Recording…" : "Record Payment"}
              pending={create.isPending}
              onCancel={onClose}
            />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
