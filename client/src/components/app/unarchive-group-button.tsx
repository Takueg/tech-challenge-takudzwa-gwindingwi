import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { Button } from "@/components/ui/button";

export function UnarchiveGroupButton({ groupId }: { groupId: string }) {
  const trpc = useTRPC();
  const invalidateExpenseData = useInvalidateExpenseData();

  const unarchiveGroup = useMutation(
    trpc.groups.unarchive.mutationOptions({
      onSuccess: () => {
        invalidateExpenseData();
        toast.success("Group unarchived");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={unarchiveGroup.isPending}
      onClick={() => unarchiveGroup.mutate({ groupId })}
    >
      {unarchiveGroup.isPending ? "Unarchiving…" : "Unarchive"}
    </Button>
  );
}
