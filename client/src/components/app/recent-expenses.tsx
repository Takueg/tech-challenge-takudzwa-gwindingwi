import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useCurrentUser } from "@/context/current-user";
import { formatCents } from "@/lib/format";

export function RecentExpenses() {
  const trpc = useTRPC();
  const { currentUserId } = useCurrentUser();
  const { data: recentExpenses } = useQuery(trpc.stats.recentExpenses.queryOptions());
  const { data: groups } = useQuery(trpc.groups.list.queryOptions());
  const { data: users } = useQuery(trpc.users.list.queryOptions());

  if (!recentExpenses || recentExpenses.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground">Recent expenses</h2>
      <div className="space-y-1 text-sm">
        {recentExpenses.map((expense) => {
          const group = groups?.find((g) => g.id === expense.groupId);
          const payer = users?.find((u) => u.id === expense.paidByUserId);
          const memberCount = group?.memberIds.length ?? 1;
          return (
            <div key={expense.id}>
              {expense.description}{" "}
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {expense.category}
              </span>{" "}
              — {payer?.name ?? "Someone"} paid in {group?.name ?? "a group"}, {formatCents(expense.amountCents)}
              {currentUserId && <> {formatCents(Math.round(expense.amountCents / memberCount))}</>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
