import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTRPC } from "@/lib/trpc";
import { formatCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewGroupDialog } from "@/components/app/new-group-dialog";
import { QuickAddExpense } from "@/components/app/quick-add-expense";
import { RecentExpenses } from "@/components/app/recent-expenses";
import { ExpenseSearch } from "@/components/app/expense-search";
import { Leaderboard } from "@/components/app/leaderboard";

export function GroupsPage() {
  const trpc = useTRPC();
  const { data: groups, isLoading } = useQuery(trpc.groups.list.queryOptions());
  const { data: users } = useQuery(trpc.users.list.queryOptions());
  const { data: stats } = useQuery(trpc.stats.overview.queryOptions());

  if (isLoading) return <p className="text-muted-foreground">Loading groups…</p>;

  return (
    <div className="space-y-4">
      {stats && (
        <div className="rounded-md border p-4 text-center">
          <p className="text-3xl font-bold">{formatCents(stats.totalCents)}</p>
          <p className="text-xs text-muted-foreground">
            spent across {stats.expenseCount} expenses in {stats.groupCount} groups
          </p>
        </div>
      )}

      {groups && groups.length > 0 && <QuickAddExpense groups={groups} />}

      {groups && <ExpenseSearch groups={groups} />}

      <RecentExpenses />

      <Leaderboard />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your groups</h1>
        <NewGroupDialog />
      </div>
      <div className="grid gap-3">
        {groups?.map((group) => {
          const memberNames = group.memberIds
            .map((id) => users?.find((u) => u.id === id)?.name ?? "?")
            .join(", ");
          return (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle>{group.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="flex flex-col gap-10">
                  <span>{memberNames}</span>
                  <span>
                    {group.expenseCount} expenses, {formatCents(group.totalCents)} total
                  </span>
                </div>
                <div className="mt-2">
                  <Link to={`/groups/${group.id}`} className="text-xs text-primary underline underline-offset-2">
                    View
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
