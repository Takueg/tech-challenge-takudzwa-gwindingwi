import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { parseAmountToCents } from "@/lib/parse-amount";
import { formatCents } from "@/lib/format";
import type { PublicUser } from "server/src/lib/db.js";

export function AddExpenseDialog({
  groupId,
  members,
}: {
  groupId: string;
  members: PublicUser[];
}) {
  const trpc = useTRPC();
  const invalidateExpenseData = useInvalidateExpenseData();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidByUserId, setPaidByUserId] = useState("");

  const createExpense = useMutation(
    trpc.expenses.create.mutationOptions({
      onSuccess: () => {
        invalidateExpenseData();
        setOpen(false);
        setDescription("");
        setAmount("");
        setPaidByUserId("");
      },
    })
  );

  const amountCents = parseAmountToCents(amount);
  const canSubmit = description.trim().length > 0 && amountCents > 0 && Boolean(paidByUserId);

  const { data: serverPreview } = useQuery({
    ...trpc.expenses.previewSplit.queryOptions({ groupId, amountCents }),
    enabled: amountCents > 0,
  });

  const { data: balancePreview } = useQuery({
    ...trpc.expenses.previewBalances.queryOptions({ groupId, amountCents, paidByUserId }),
    enabled: amountCents > 0 && Boolean(paidByUserId),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dinner, tickets, taxi…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (EUR)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paid-by">Paid by</Label>
            <Select value={paidByUserId} onValueChange={setPaidByUserId}>
              <SelectTrigger id="paid-by" className="w-full">
                <SelectValue placeholder="Who paid?" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Split equally among all {members.length} group members:
            </p>
          </div>

          {serverPreview && serverPreview.length > 0 && (
            <div className="space-y-1">
              <ul className="space-y-0.5 rounded-md bg-muted/40 p-2 text-xs">
                {serverPreview.map((split) => (
                  <li key={split.userId} className="flex justify-between">
                    <span>{members.find((m) => m.id === split.userId)?.name ?? split.userId}</span>
                    <span>{formatCents(split.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {balancePreview && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium">After this expense</p>
              <ul className="space-y-0.5 text-xs">
                {balancePreview.balances.map((b) => (
                  <li key={b.userId} className="flex justify-between">
                    <span>{members.find((m) => m.id === b.userId)?.name ?? b.userId}</span>
                    <span className={b.netCents >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {b.netCents === 0
                        ? "settled up"
                        : b.netCents > 0
                          ? `is owed ${formatCents(b.netCents)}`
                          : `owes ${formatCents(-b.netCents)}`}
                    </span>
                  </li>
                ))}
              </ul>
              {balancePreview.suggestedTransfers.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {balancePreview.suggestedTransfers.map((t, i) => (
                    <li key={i}>
                      {members.find((m) => m.id === t.fromUserId)?.name ?? t.fromUserId} → {" "}
                      {members.find((m) => m.id === t.toUserId)?.name ?? t.toUserId}:{" "}
                      {formatCents(t.amountCents)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={!canSubmit || createExpense.isPending}
            onClick={() => createExpense.mutate({ groupId, description: description.trim(), amountCents, paidByUserId })}
          >
            {createExpense.isPending ? "Adding…" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
