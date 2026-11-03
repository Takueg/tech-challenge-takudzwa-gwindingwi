import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { parseAmountToCents } from "@/lib/parse-amount";
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

export function EditExpenseDialog({
  expenseId,
  currentDescription,
  currentAmountCents,
  currentReceiptUrl,
}: {
  expenseId: string;
  currentDescription: string;
  currentAmountCents: number;
  currentReceiptUrl?: string;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(currentDescription);
  const [amount, setAmount] = useState((currentAmountCents / 100).toFixed(2));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateExpense = useMutation(
    trpc.expenses.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        setOpen(false);
      },
    })
  );

  const uploadReceipt = useMutation(
    trpc.expenses.uploadReceipt.mutationOptions({
      onSuccess: invalidate,
    })
  );

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadReceipt.mutate({ expenseId, receiptUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  }

  const amountCents = parseAmountToCents(amount);
  const canSubmit = description.trim().length > 0 && amountCents > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDescription(currentDescription);
          setAmount((currentAmountCents / 100).toFixed(2));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Edit expense">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Amount (EUR)</Label>
            <Input id="edit-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Receipt</Label>
            {currentReceiptUrl && (
              <img src={currentReceiptUrl} alt="Receipt" className="h-20 rounded border object-cover" />
            )}
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                {currentReceiptUrl ? "Replace receipt" : "Attach receipt"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReceiptChange}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!canSubmit || updateExpense.isPending}
            onClick={() => updateExpense.mutate({ expenseId, description: description.trim(), amountCents })}
          >
            {updateExpense.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
