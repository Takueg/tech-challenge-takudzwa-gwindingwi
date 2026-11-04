import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AddMemberDialog } from "@/components/app/add-member-dialog";
import { useAppDialogs } from "@/components/app/app-dialogs";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ExpenseFormDialog } from "@/components/app/expense-form-dialog";
import { BalancesTab, type Payment, type Transfer } from "@/components/app/group/balances-tab";
import { LoadingPanels } from "@/components/app/group/loading-panels";
import { MembersTab } from "@/components/app/group/members-tab";
import { GroupOptionsMenu } from "@/components/app/group/options-menu";
import { ExpensesTable } from "@/components/app/expenses-table";
import { HeaderActions, PageLayout } from "@/components/app/page-layout";
import { Panel } from "@/components/app/panel";
import { SpendingPanels } from "@/components/app/spending-panels";
import { ErrorState } from "@/components/app/states";
import { SummaryCard, SummaryCardSkeleton } from "@/components/app/summary-card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl, Tabs, TabsContent } from "@/components/ui/tabs";
import { useCurrentUserId } from "@/context/current-user";
import {
  useArchiveGroup,
  useDeleteExpense,
  useDeleteGroup,
  useDeletePayment,
  useRecordPayment,
  useUnarchiveGroup,
} from "@/hooks/use-group-actions";
import { spendersFromExpenses } from "@/lib/charts";
import { slugify } from "@/lib/expense-table";
import { formatCents } from "@/lib/format";
import { useTRPC, type RouterOutputs } from "@/lib/trpc";

type Expense = RouterOutputs["groups"]["detail"]["expenses"][number];

type ConfirmState = {
  title: string;
  question: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  fromOptionsMenu?: boolean;
};

const TABS = ["Expenses", "Balances", "Members"];
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  // Remount per group, so tabs, filters and dialogs never carry over to the next one.
  return <GroupDetail key={groupId} groupId={groupId as string} />;
}

function GroupDetail({ groupId }: { groupId: string }) {
  const trpc = useTRPC();
  const currentUserId = useCurrentUserId();
  const { newExpenseId, markNewExpense } = useAppDialogs();
  const detail = useQuery(trpc.groups.detail.queryOptions({ groupId, userId: currentUserId }));
  const [tab, setTab] = useState(TABS[0]);
  const [formOpen, setFormOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [deletedName, setDeletedName] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const optionsRef = useRef<HTMLButtonElement>(null);

  const data = detail.data;
  const everyone = data ? [...data.members, ...data.formerMembers] : [];
  const nameOf = (userId: string) => everyone.find((person) => person.id === userId)?.name ?? "Unknown";
  const loading = detail.isLoading;
  const myNet = data?.balances.find((balance) => balance.userId === currentUserId)?.netCents ?? 0;
  const totalCents = data?.expenses.reduce((sum, expense) => sum + expense.amountCents, 0) ?? 0;
  const readOnly = Boolean(data?.group.archivedAt);
  const groupName = deletedName ?? data?.group.name ?? "";

  const deleteExpense = useDeleteExpense((id) => data?.expenses.find((expense) => expense.id === id)?.description);
  const createSettlement = useRecordPayment(nameOf);
  const deleteSettlement = useDeletePayment();
  const archive = useArchiveGroup();
  const unarchive = useUnarchiveGroup();
  const removeGroup = useDeleteGroup(groupName, () => setDeletedName(data?.group.name ?? "This group"));

  const tableExpenses = (data?.expenses ?? []).map((expense) => ({ ...expense, groupName }));
  const spenders = spendersFromExpenses(data?.expenses ?? []);

  const askDeleteExpense = (expenseId: string) => {
    const expense = data?.expenses.find((candidate) => candidate.id === expenseId);
    if (!expense) return;
    setConfirm({
      title: "Delete Expense",
      question: `Delete “${expense.description}”?`,
      body: `This removes ${formatCents(expense.amountCents)} from ${groupName} and updates everyone’s balances. You can undo right after.`,
      confirmLabel: "Yes, Delete",
      cancelLabel: "Keep It",
      onConfirm: () => deleteExpense.mutate({ expenseId, userId: currentUserId }),
    });
  };
  const askRecord = (transfer: Transfer) =>
    setConfirm({
      title: "Record A Payment",
      question: `Did ${nameOf(transfer.fromUserId)} pay ${nameOf(transfer.toUserId)} ${formatCents(transfer.amountCents)}?`,
      body: "This marks the debt as paid in Splitwise Lite. It doesn’t send any money.",
      confirmLabel: "Yes, Record It",
      cancelLabel: "Not Yet",
      onConfirm: () => createSettlement.mutate({ groupId, ...transfer }),
    });
  const askDeletePayment = (settlement: Payment) =>
    setConfirm({
      title: "Delete Payment",
      question: `Delete the ${formatCents(settlement.amountCents)} payment?`,
      body: "The debt goes back on the balances. You can undo right after.",
      confirmLabel: "Yes, Delete",
      cancelLabel: "Keep It",
      onConfirm: () => deleteSettlement.mutate({ settlementId: settlement.id }),
    });
  const askArchive = () =>
    setConfirm({
      title: `Archive ${groupName}?`,
      question: "It’ll be hidden and read-only.",
      body: "Balances are kept and you can unarchive any time.",
      confirmLabel: "Yes, Archive",
      cancelLabel: "Cancel",
      onConfirm: () => archive.mutate({ groupId }),
      fromOptionsMenu: true,
    });
  const askDeleteGroup = () =>
    setConfirm({
      title: `Delete ${groupName}?`,
      question: "This can’t be undone.",
      body: `It permanently deletes ${plural(data?.expenses.length ?? 0, "expense")} and ${plural(data?.settlements.length ?? 0, "payment")} for everyone in the group.`,
      confirmLabel: "Yes, Delete Group",
      cancelLabel: "Keep Group",
      onConfirm: () => removeGroup.mutate({ groupId }),
      fromOptionsMenu: true,
    });

  const header = (
    <div className="flex flex-col gap-[22px]">
      <HeaderActions />
      {!deletedName && !detail.isError && (
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-3">
            {loading ? (
              <span className="flex min-h-11 items-center">
                <Skeleton onScreen width={260} height={36} />
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 ref={titleRef} className="m-0 [font:600_30px/36px_var(--font-poppins)]">
                  {data?.group.name}
                </h1>
                <GroupOptionsMenu
                  groupName={groupName}
                  archived={readOnly}
                  hasOpenBalances={Boolean(data?.balances.some((balance) => balance.netCents !== 0))}
                  titleRef={titleRef}
                  triggerRef={optionsRef}
                  onArchive={askArchive}
                  onUnarchive={() => unarchive.mutate({ groupId })}
                  onDelete={askDeleteGroup}
                />
              </div>
            )}
            {loading ? (
              <span aria-hidden="true" className="flex gap-1">
                <Skeleton onScreen round width={32} height={32} />
                <Skeleton onScreen round width={32} height={32} />
                <Skeleton onScreen round width={32} height={32} />
              </span>
            ) : (
              <span aria-label={`Members: ${data?.members.map((m) => m.name).join(", ")}`} role="img" className="flex">
                {data?.members.map((member) => (
                  <span
                    key={member.id}
                    className="-mr-2 box-border flex size-9 items-center justify-center rounded-full border-2 border-solid border-[var(--caribbean-green)] bg-honeydew [font:600_13px/1_var(--font-poppins)] text-ink"
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </span>
            )}
          </div>
          <section aria-label="Group totals" className="flex flex-wrap items-stretch gap-[18px]">
            {loading ? (
              <>
                <span className="sr-only" role="status">
                  Loading group…
                </span>
                <SummaryCardSkeleton />
                <SummaryCardSkeleton />
              </>
            ) : (
              <>
                <SummaryCard label="Group Spending" amount={formatCents(totalCents)} />
                <SummaryCard
                  expense={myNet < 0}
                  label={myNet > 0 ? "You’re Owed" : myNet < 0 ? "You Owe" : "All Settled"}
                  amount={formatCents(myNet)}
                />
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );

  if (deletedName) {
    return (
      <PageLayout header={header}>
        <div role="status" className="flex flex-col items-center gap-3.5 px-4 py-20 text-center">
          <span aria-hidden="true" className="flex size-[72px] items-center justify-center rounded-3xl bg-sunken">
            <Icon name="delete" size={32} />
          </span>
          <h2 className="m-0 [font:600_20px/28px_var(--font-poppins)] text-strong">{deletedName} Was Deleted</h2>
          <p className="m-0 [font:400_15px/22px_var(--font-spartan)] text-muted-foreground">
            Its expenses and payments are gone for everyone in the group.
          </p>
          <Button asChild>
            <Link to="/">Back To Dashboard</Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (detail.isError) {
    return (
      <PageLayout header={header}>
        <Panel>
          <ErrorState title="We Couldn’t Load This Group" onRetry={() => detail.refetch()} showBack />
        </Panel>
      </PageLayout>
    );
  }

  return (
    <PageLayout busy={loading} header={header} sheetClassName="pt-10">
      <div className="flex flex-col gap-7">
        {readOnly && (
          <div role="status" className="app-sunken flex flex-wrap items-center gap-3.5 rounded-[22px] bg-sunken px-5 py-4">
            <Icon name="archive" size={24} />
            <span className="flex-[1_1_280px] [font:400_15px/22px_var(--font-poppins)]">
              <strong className="font-semibold">This group is archived.</strong> It’s hidden from your dashboard and
              read-only. Balances are kept.
            </span>
            <Button variant="secondary" disabled={unarchive.isPending} onClick={() => unarchive.mutate({ groupId })}>
              Unarchive
            </Button>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="w-[460px] max-w-full">
              <SegmentedControl options={TABS} aria-label="Group sections" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                className="bg-sunken text-foreground"
                disabled={readOnly || loading}
                onClick={() => setAddMemberOpen(true)}
              >
                Add Member
              </Button>
              <Button
                disabled={readOnly || loading}
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                Add Expense
              </Button>
            </div>
          </div>

          <TabsContent value="Expenses" className="flex flex-col gap-6">
            <ExpensesTable
              heading="Group Expenses"
              expenses={tableExpenses}
              showActions
              readOnly={readOnly}
              loading={loading}
              onEdit={(expenseId) => {
                setEditing(data?.expenses.find((expense) => expense.id === expenseId));
                setFormOpen(true);
              }}
              onDelete={askDeleteExpense}
              onAdd={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
              exportFileName={slugify(groupName) || "group"}
              newId={newExpenseId}
            />
            <SpendingPanels
              categoryTotals={data?.categoryTotals ?? {}}
              spenders={spenders}
              spendersLabel={`Top spenders in ${groupName}`}
              loading={loading}
              skeletonRows={3}
            />
          </TabsContent>
          <TabsContent value="Balances">
            {loading || !data ? (
              <LoadingPanels />
            ) : (
              <BalancesTab
                data={data}
                nameOf={nameOf}
                readOnly={readOnly}
                onRecord={askRecord}
                onDeletePayment={askDeletePayment}
              />
            )}
          </TabsContent>
          <TabsContent value="Members">
            {loading || !data ? (
              <LoadingPanels />
            ) : (
              <MembersTab data={data} readOnly={readOnly} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {formOpen && data && (
        <ExpenseFormDialog
          groupId={groupId}
          groupName={groupName}
          members={data.members}
          people={everyone}
          expense={editing}
          onClose={() => setFormOpen(false)}
          onAdded={(expenseId) => {
            markNewExpense(expenseId);
            setTab(TABS[0]);
          }}
        />
      )}
      {addMemberOpen && data && (
        <AddMemberDialog
          groupId={groupId}
          groupName={groupName}
          memberIds={data.group.memberIds}
          onClose={() => setAddMemberOpen(false)}
          onAdded={() => setTab("Members")}
        />
      )}
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={confirm.title}
          question={confirm.question}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={confirm.cancelLabel}
          onConfirm={confirm.onConfirm}
          returnFocusRef={confirm.fromOptionsMenu ? optionsRef : undefined}
        />
      )}
    </PageLayout>
  );
}
