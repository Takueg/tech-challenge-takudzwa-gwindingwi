import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAppDialogs } from "@/components/app/app-dialogs";
import { ArchivedGroups } from "@/components/app/archived-groups";
import { ExpensesTable } from "@/components/app/expenses-table";
import { HeaderActions, PageLayout } from "@/components/app/page-layout";
import { Panel } from "@/components/app/panel";
import { SpendingPanels } from "@/components/app/spending-panels";
import { EmptyState, ErrorState } from "@/components/app/states";
import { SummaryCard, SummaryCardSkeleton } from "@/components/app/summary-card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserId } from "@/context/current-user";
import { useMyBalances, useMyDebts, useMyExpenses, useMyGroups, useUsers } from "@/hooks/use-data";
import { formatCents } from "@/lib/format";
import { settleHint } from "@/lib/split-preview";
import { useTRPC, type RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const EMPTY_TOTALS: Record<string, number> = {};

function TotalsHeader({
  loading,
  overview,
  balances,
}: {
  loading: boolean;
  overview?: RouterOutputs["stats"]["overview"];
  balances?: RouterOutputs["stats"]["myBalances"];
}) {
  return (
    <section aria-label="Your totals" className="flex flex-wrap items-center gap-[18px]">
      <div className="flex flex-[1_1_260px] flex-col gap-2.5">
        <span className="[font:500_13px/1_var(--font-poppins)]">Total Spent</span>
        {loading ? (
          <>
            <span className="sr-only" role="status">
              Loading your totals…
            </span>
            <Skeleton onScreen width={210} height={36} />
            <Skeleton onScreen line width={120} />
          </>
        ) : (
          <>
            <span className="[font:700_36px/1_var(--font-poppins)]">{overview ? formatCents(overview.totalCents) : "-"}</span>
            <span className="[font:400_15px/1.2_var(--font-spartan)]">
              {overview
                ? `Across ${overview.groupCount} ${overview.groupCount === 1 ? "group" : "groups"}`
                : "Couldn’t load your totals"}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-none gap-[18px]">
        {loading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard label="You Are Owed" amount={balances ? formatCents(balances.owedCents) : "-"} />
            <SummaryCard
              expense
              label="You Owe"
              amount={balances ? formatCents(balances.oweCents === 0 ? 0 : -balances.oweCents) : "-"}
            />
          </>
        )}
      </div>
    </section>
  );
}

function GroupCardSkeleton() {
  return (
    <div aria-hidden="true" className="app-skel-card">
      <span className="flex min-h-12 items-start justify-between gap-3">
        <span className="flex flex-col gap-2.5">
          <Skeleton line width={130} height={18} />
          <Skeleton line width={150} height={12} />
        </span>
        <Skeleton round width={20} height={20} />
      </span>
      <span className="h-px bg-[var(--rule)]" />
      <span className="flex flex-col gap-2">
        {[52, 36, 60].map((labelWidth, index) => (
          <span key={labelWidth} className="flex h-5 items-center justify-between gap-3">
            <Skeleton line width={labelWidth} height={10} />
            <Skeleton line width={index === 0 ? 24 : 76} />
          </span>
        ))}
      </span>
    </div>
  );
}

function GroupCard({
  group,
  memberText,
  netCents,
}: {
  group: RouterOutputs["groups"]["list"][number];
  memberText: string;
  /** Undefined when balances couldn't load, which must never read as settled. */
  netCents?: number;
}) {
  const label =
    netCents === undefined ? "Balance" : netCents > 0 ? "You’re Owed" : netCents < 0 ? "You Owe" : "All Settled";
  const row = "flex items-baseline justify-between gap-3";
  const stat = "whitespace-nowrap [font:600_16px/20px_var(--font-poppins)] text-strong";
  const caption = "[font:400_12px/16px_var(--font-poppins)] text-muted-foreground";
  return (
    <li>
      <Link
        to={`/groups/${group.id}`}
        className="app-card box-border flex h-full flex-col gap-4 rounded-[31px] bg-sunken px-[26px] py-6 text-foreground no-underline"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="[font:600_18px/24px_var(--font-poppins)] text-strong">{group.name}</span>
            <span className="[font:400_13px/18px_var(--font-poppins)] text-muted-foreground">{memberText}</span>
          </span>
          <Icon name="arrow_forward" size={20} />
        </span>
        <span className="h-px bg-[var(--rule)]" />
        <span className="flex flex-col gap-2">
          <span className={row}>
            <span className={caption}>Expenses</span>
            <span className={stat}>{group.expenseCount}</span>
          </span>
          <span className={row}>
            <span className={caption}>Total</span>
            <span className={stat}>{formatCents(group.totalCents)}</span>
          </span>
          <span className={row}>
            <span className={caption}>{label}</span>
            <span className={cn(stat, netCents !== undefined && netCents < 0 && "text-accent-ink")}>
              {netCents === undefined ? "-" : netCents === 0 ? "Settled Up" : formatCents(netCents)}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function DashboardPage() {
  const trpc = useTRPC();
  const currentUserId = useCurrentUserId();
  const { openAddExpense, openSettleUp, openNewGroup, newExpenseId } = useAppDialogs();
  const userInput = { userId: currentUserId };

  const overview = useQuery(trpc.stats.overview.queryOptions(userInput));
  const balances = useMyBalances();
  const debts = useMyDebts();
  const expenses = useMyExpenses();
  const leaderboard = useQuery(trpc.stats.leaderboard.queryOptions(userInput));
  const groups = useMyGroups();
  const users = useUsers();

  const headerLoading = overview.isLoading || balances.isLoading;
  const busy = headerLoading || debts.isLoading || expenses.isLoading || groups.isLoading;
  const nameOf = (userId: string) =>
    userId === currentUserId ? "You" : (users.data?.find((user) => user.id === userId)?.name ?? "…");
  const netOf = (groupId: string) =>
    balances.data ? (balances.data.perGroup.find((g) => g.groupId === groupId)?.netCents ?? 0) : undefined;
  const owedBy = debts.data?.filter((debt) => debt.toUserId === currentUserId).length ?? 0;
  const owes = debts.data?.filter((debt) => debt.fromUserId === currentUserId).length ?? 0;

  return (
    <PageLayout
      busy={busy}
      header={
        <div className="flex flex-col gap-7">
          <HeaderActions />
          <TotalsHeader
            loading={headerLoading}
            overview={overview.data}
            balances={balances.data}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-10">
        <section aria-label="Quick actions" className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
          <button
            type="button"
            onClick={() => openAddExpense()}
            className="app-card flex cursor-pointer items-center gap-[18px] rounded-[31px] border-0 bg-primary px-6 py-[22px] text-left text-on-primary"
          >
            <span aria-hidden="true" className="flex size-[52px] flex-none items-center justify-center rounded-[18px] bg-honeydew text-ink">
              <Icon name="add" size={24} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="[font:600_20px/22px_var(--font-poppins)]">Add Expense</span>
              <span className="[font:400_14px/18px_var(--font-spartan)]">Log something you paid for a group</span>
            </span>
          </button>
          <button
            type="button"
            onClick={openSettleUp}
            className="app-card flex cursor-pointer items-center gap-[18px] rounded-[31px] border-0 bg-sunken px-6 py-[22px] text-left text-foreground"
          >
            <span aria-hidden="true" className="flex size-[52px] flex-none items-center justify-center rounded-[18px] bg-ocean text-honeydew">
              <Icon name="handshake" size={24} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="[font:600_20px/22px_var(--font-poppins)] text-strong">Settle Up</span>
              {debts.isLoading ? (
                <Skeleton line width={170} height={12} className="mt-[3px]" />
              ) : (
                <span className="[font:400_14px/18px_var(--font-spartan)] text-muted-foreground">
                  {debts.data ? settleHint(owedBy, owes) : "Couldn’t load your balances"}
                </span>
              )}
            </span>
          </button>
        </section>

        <ExpensesTable
          heading="All Expenses"
          expenses={expenses.data ?? []}
          showGroup
          loading={expenses.isLoading}
          error={expenses.isError}
          onRetry={() => expenses.refetch()}
          onAdd={() => openAddExpense()}
          exportFileName="splitwise-lite-expenses"
          newId={newExpenseId}
        />

        <SpendingPanels
          categoryTotals={overview.data?.categoryTotals ?? EMPTY_TOTALS}
          spenders={leaderboard.data ?? []}
          spendersLabel="Top spenders"
          loading={overview.isLoading || leaderboard.isLoading}
          error={overview.isError || leaderboard.isError}
          onRetry={() => {
            overview.refetch();
            leaderboard.refetch();
          }}
        />

        <section aria-labelledby="gr-title" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="gr-title" className="m-0 [font:600_20px/22px_var(--font-poppins)] text-strong">
              Your Groups
            </h2>
            <Button variant="secondary" onClick={openNewGroup}>
              New Group
            </Button>
          </div>
          {groups.isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <GroupCardSkeleton key={n} />
              ))}
            </div>
          ) : groups.isError ? (
            <Panel>
              <ErrorState title="We Couldn’t Load Your Groups" onRetry={() => groups.refetch()} />
            </Panel>
          ) : groups.data?.length === 0 ? (
            <Panel>
              <EmptyState
                icon="group"
                title="No Groups Yet"
                body="Start one for a trip, a flat or a regular dinner."
                action={<Button onClick={openNewGroup}>New Group</Button>}
              />
            </Panel>
          ) : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6 p-0">
              {groups.data?.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  memberText={group.memberIds.map(nameOf).join(", ")}
                  netCents={netOf(group.id)}
                />
              ))}
            </ul>
          )}
          <ArchivedGroups />
        </section>
      </div>
    </PageLayout>
  );
}
