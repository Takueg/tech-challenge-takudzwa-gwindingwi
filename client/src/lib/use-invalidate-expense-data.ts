import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

/** Refreshes everything derived from expenses and payments: group pages, dashboard stats, tables and debts. */
export function useInvalidateExpenseData() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries(trpc.groups.pathFilter());
    queryClient.invalidateQueries(trpc.stats.pathFilter());
    queryClient.invalidateQueries(trpc.expenses.pathFilter());
    queryClient.invalidateQueries(trpc.settlements.pathFilter());
  };
}
