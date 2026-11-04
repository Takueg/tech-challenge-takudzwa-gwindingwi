import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/context/current-user";
import { useTRPC } from "@/lib/trpc";

export function useUsers() {
  const trpc = useTRPC();
  return useQuery(trpc.users.list.queryOptions());
}

export function useMyGroups() {
  const trpc = useTRPC();
  const userId = useCurrentUserId();
  return useQuery(trpc.groups.list.queryOptions({ userId }));
}

export function useMyArchivedGroups() {
  const trpc = useTRPC();
  const userId = useCurrentUserId();
  return useQuery(trpc.groups.listArchived.queryOptions({ userId }));
}

export function useMyExpenses() {
  const trpc = useTRPC();
  const userId = useCurrentUserId();
  return useQuery(trpc.expenses.list.queryOptions({ userId }));
}

export function useMyBalances() {
  const trpc = useTRPC();
  const userId = useCurrentUserId();
  return useQuery(trpc.stats.myBalances.queryOptions({ userId }));
}

export function useMyDebts() {
  const trpc = useTRPC();
  const userId = useCurrentUserId();
  return useQuery(trpc.settlements.suggestedForUser.queryOptions({ userId }));
}
