import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { formatCents } from "@/lib/format";
import type { Transfer } from "server/src/lib/balances.js";

export function SettleUpDialog({
  groupId,
  transfer,
  fromName,
  toName,
}: {
  groupId: string;
  transfer: Transfer;
  fromName: string;
  toName: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const createSettlement = useMutation(
    trpc.settlements.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.groups.detail.queryKey({ groupId }) });
        setOpen(false);
      },
    })
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Settle up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm settlement</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          Record that <span className="font-medium">{fromName}</span> paid{" "}
          <span className="font-medium">{formatCents(transfer.amountCents)}</span> to{" "}
          <span className="font-medium">{toName}</span>.
        </p>
        <DialogFooter>
          <Button
            disabled={createSettlement.isPending}
            onClick={() =>
              createSettlement.mutate({
                groupId,
                fromUserId: transfer.fromUserId,
                toUserId: transfer.toUserId,
                amountCents: transfer.amountCents,
              })
            }
          >
            {createSettlement.isPending ? "Recording…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
