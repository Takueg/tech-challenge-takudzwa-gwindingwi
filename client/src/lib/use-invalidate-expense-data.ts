import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

/** Refreshes everything derived from expenses: group pages, home page stats and search results. */
export function useInvalidateExpenseData() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries(trpc.groups.pathFilter());
    queryClient.invalidateQueries(trpc.stats.pathFilter());
    queryClient.invalidateQueries(trpc.expenses.pathFilter());
  };
}
