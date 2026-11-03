import { useRef, useState, type RefObject } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import { Link, useParams } from "react-router-dom";
import { AddMemberDialog } from "@/components/app/add-member-dialog";
import { useAppDialogs } from "@/components/app/app-dialogs";
import { IconTile } from "@/components/app/category-tile";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ExpenseFormDialog } from "@/components/app/expense-form-dialog";
import { ExpensesTable } from "@/components/app/expenses-table";
import { Breadcrumb, HeaderActions, PageLayout } from "@/components/app/page-layout";
import { Panel } from "@/components/app/panel";
import { SpendingPanels } from "@/components/app/spending-panels";
import { ErrorState } from "@/components/app/states";
import { SummaryCard, SummaryCardSkeleton } from "@/components/app/summary-card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl, Tabs, TabsContent } from "@/components/ui/tabs";
import { useCurrentUser } from "@/context/current-user";
import { spendersFromExpenses } from "@/lib/charts";
import { slugify } from "@/lib/expense-table";
import { formatCents, formatTimestamp } from "@/lib/format";
import { notify } from "@/lib/notify";
import { trpcClient, useTRPC, type RouterOutputs } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { useUndo } from "@/lib/use-undo";
import { cn } from "@/lib/utils";

type Detail = RouterOutputs["groups"]["detail"];
type Expense = Detail["expenses"][number];
type Transfer = Detail["suggestedTransfers"][number];

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
const initialOf = (name: string) => name.charAt(0).toUpperCase();
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function Initial({ name, size, className }: { name: string; size: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex flex-none items-center justify-center rounded-full font-semibold", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initialOf(name)}
    </span>
  );
}

function LoadingPanels() {
  return (
    <div role="status" className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
      <span className="sr-only">Loading…</span>
      {[1, 2, 3].map((n) => (
        <div key={n} aria-hidden="true" className="swl-panel">
          <Skeleton line width={160} height={18} />
          <div className="flex items-center gap-3.5">
            <Skeleton round width={40} height={40} />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton line width="60%" />
              <Skeleton line width="40%" height={10} />
            </span>
          </div>
          <div className="flex items-center gap-3.5">
            <Skeleton round width={40} height={40} />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton line width="52%" />
              <Skeleton line width="34%" height={10} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BalancesTab({
  data,
  nameOf,
  readOnly,
  onRecord,
  onDeletePayment,
}: {
  data: Detail;
  nameOf: (userId: string) => string;
  readOnly: boolean;
  onRecord: (transfer: Transfer) => void;
  onDeletePayment: (settlement: Detail["settlements"][number]) => void;
}) {
  const { currentUserId } = useCurrentUser();
  const isFormer = (userId: string) => data.formerMembers.some((member) => member.id === userId);
  const display = (userId: string) => (userId === currentUserId ? "You" : nameOf(userId));

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
        <Panel title="Suggested Payments">
          <p className="m-0 [font:400_14px/20px_var(--font-poppins)] text-muted-foreground">
            The fewest payments that settle everyone. Recording one doesn’t move money. Pay outside the app first, then
            record it here.
          </p>
          {data.suggestedTransfers.length === 0 ? (
            <div role="status" className="flex items-center gap-4 rounded-[22px] bg-sheet p-5">
              <span aria-hidden="true" className="flex size-12 flex-none items-center justify-center rounded-full bg-primary text-ink">
                <Icon name="check" size={24} />
              </span>
              <span className="flex flex-col gap-1">
                <strong className="[font:600_16px/22px_var(--font-poppins)] text-strong">Everyone’s Settled Up</strong>
                <span className="[font:400_14px/20px_var(--font-poppins)] text-muted-foreground">
                  Nobody owes anything in {data.group.name} right now.
                </span>
              </span>
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {data.suggestedTransfers.map((transfer) => {
                const from = nameOf(transfer.fromUserId);
                const to = nameOf(transfer.toUserId);
                const text =
                  transfer.fromUserId === currentUserId
                    ? `You pay ${to}`
                    : `${from} pays ${transfer.toUserId === currentUserId ? "you" : to}`;
                return (
                  <li
                    key={`${transfer.fromUserId}-${transfer.toUserId}`}
                    className="flex flex-wrap items-center gap-4 rounded-[22px] bg-sheet px-[18px] py-4"
                  >
                    <span aria-hidden="true" className="flex items-center gap-1.5">
                      <Initial name={from} size={36} className="bg-light-green text-ink" />
                      <Icon name="arrow_forward" size={16} />
                      <Initial name={to} size={36} className="bg-primary text-ink" />
                    </span>
                    <span className="flex flex-[1_1_180px] flex-col gap-[3px]">
                      <span className="[font:500_15px/20px_var(--font-poppins)]">{text}</span>
                      <span className="[font:600_17px/22px_var(--font-poppins)] text-accent-ink">
                        {formatCents(transfer.amountCents)}
                      </span>
                    </span>
                    <Button variant="secondary" disabled={readOnly} onClick={() => onRecord(transfer)}>
                      Record Payment
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Payment History">
          {data.settlements.length === 0 ? (
            <p className="m-0 [font:400_14px/20px_var(--font-spartan)] text-muted-foreground">
              No payments recorded yet.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {data.settlements.map((settlement) => (
                <li key={settlement.id} className="flex items-center gap-3.5">
                  <IconTile icon="handshake" background="var(--ocean-blue)" />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="[font:500_15px/20px_var(--font-poppins)]">
                      {nameOf(settlement.fromUserId)} paid {nameOf(settlement.toUserId)}
                    </span>
                    <span className="swl-row__time">{formatTimestamp(settlement.createdAt)}</span>
                  </span>
                  <span className="[font:500_15px/20px_var(--font-poppins)] text-strong">
                    {formatCents(settlement.amountCents)}
                  </span>
                  <Button
                    variant="icon"
                    aria-label={`Delete payment from ${nameOf(settlement.fromUserId)} to ${nameOf(settlement.toUserId)}`}
                    title="Delete"
                    disabled={readOnly}
                    onClick={() => onDeletePayment(settlement)}
                  >
                    <Icon name="delete" size={20} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Net Balances" className="flex-[1_1_320px]">
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {data.balances.map((balance) => (
            <li key={balance.userId} className="flex items-center gap-3">
              <Initial name={nameOf(balance.userId)} size={40} className="bg-honeydew text-ink" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="[font:500_15px/20px_var(--font-poppins)]">{display(balance.userId)}</span>
                {isFormer(balance.userId) && (
                  <span className="[font:400_12px/16px_var(--font-poppins)] text-muted-foreground">Former member</span>
                )}
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="[font:400_12px/16px_var(--font-poppins)] text-muted-foreground">
                  {balance.netCents > 0 ? "Is Owed" : balance.netCents < 0 ? "Owes" : "Settled Up"}
                </span>
                <span
                  className={cn(
                    "[font:600_15px/20px_var(--font-poppins)]",
                    balance.netCents < 0 ? "text-accent-ink" : "text-strong"
                  )}
                >
                  {formatCents(Math.abs(balance.netCents))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/**
 * The only place to archive or delete a group. Neither is allowed while anyone owes money, which the server
 * also enforces. The menu lines up under the group name, not the button.
 */
function GroupOptionsMenu({
  groupName,
  archived,
  hasOpenBalances,
  titleRef,
  triggerRef,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  groupName: string;
  archived: boolean;
  hasOpenBalances: boolean;
  titleRef: RefObject<HTMLHeadingElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const [alignOffset, setAlignOffset] = useState(0);
  const title = "flex flex-col gap-[3px]";
  const settleFirst = "Everyone needs to settle up first";
  const description = "[font:400_13px/18px_var(--font-poppins)] text-muted-foreground";
  return (
    <DropdownMenu.Root
      modal={false}
      onOpenChange={(open) => {
        const [name, trigger] = [titleRef.current, triggerRef.current];
        if (open && name && trigger) {
          setAlignOffset(name.getBoundingClientRect().left - trigger.getBoundingClientRect().left);
        }
      }}
    >
      <DropdownMenu.Trigger
        ref={triggerRef}
        className="app-iconbtn"
        aria-label={`Group options for ${groupName}`}
        title="Group options"
      >
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-honeydew text-ink">
          <Icon name="more_horiz" size={20} />
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          alignOffset={alignOffset}
          sideOffset={8}
          aria-label="Group options"
          className="z-40 box-border flex w-[320px] flex-col gap-0.5 rounded-[20px] bg-dialog p-2.5 text-foreground"
        >
          <DropdownMenu.Item
            className="app-option"
            disabled={!archived && hasOpenBalances}
            onSelect={archived ? onUnarchive : onArchive}
          >
            <Icon name="archive" size={20} />
            <span className={title}>
              <span className="app-option__title">{archived ? "Unarchive Group" : "Archive Group"}</span>
              <span className={description}>
                {archived
                  ? "Put it back on your dashboard"
                  : hasOpenBalances
                    ? settleFirst
                    : "Hide it from your dashboard and make it read-only"}
              </span>
            </span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="mx-2.5 my-1.5 h-px bg-[var(--rule)]" />
          <DropdownMenu.Item className="app-option app-option--danger" disabled={hasOpenBalances} onSelect={onDelete}>
            <Icon name="delete" size={20} />
            <span className={title}>
              <span className="app-option__title">Delete Group</span>
              <span className={description}>
                {hasOpenBalances ? settleFirst : "Removes every expense and payment. Can’t be undone."}
              </span>
            </span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MembersTab({ data, readOnly }: { data: Detail; readOnly: boolean }) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  const { currentUserId } = useCurrentUser();
  const { group, members, balances } = data;
  const netOf = (userId: string) => balances.find((balance) => balance.userId === userId)?.netCents ?? 0;

  const remove = useMutation(
    trpc.groups.removeMembers.mutationOptions({
      meta: { errorTitle: "Couldn’t Remove Member" },
      onSuccess: (_group, { userIds }) => {
        invalidate();
        const name = members.find((member) => member.id === userIds[0])?.name ?? "They";
        notify.success({
          title: `${name} Removed`,
          body: `${name} no longer shares new expenses in ${group.name}.`,
          onUndo: () => undo(() => trpcClient.groups.addMembers.mutate({ groupId: group.id, userIds })),
        });
      },
    })
  );

  const memberNote = (userId: string, index: number) => {
    if (userId === currentUserId) return index === 0 ? "Group creator" : "Member";
    const net = netOf(userId);
    return net === 0
      ? "Settled up, can be removed"
      : `Settle their ${formatCents(Math.abs(net))} balance before removing them`;
  };

  return (
    <Panel title="Members">
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {members.map((member, index) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3.5">
            <Initial name={member.name} size={44} className="bg-honeydew text-ink" />
            <span className="flex flex-[1_1_160px] flex-col gap-[3px]">
              <span className="[font:500_15px/20px_var(--font-poppins)]">
                {member.id === currentUserId ? `${member.name} (You)` : member.name}
              </span>
              <span className="[font:400_13px/18px_var(--font-poppins)] text-muted-foreground">
                {memberNote(member.id, index)}
              </span>
            </span>
            {member.id !== currentUserId && netOf(member.id) === 0 && (
              <Button
                variant="text"
                disabled={readOnly || remove.isPending}
                onClick={() => remove.mutate({ groupId: group.id, userIds: [member.id] })}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  // Remount per group, so tabs, filters and dialogs never carry over to the next one.
  return <GroupDetail key={groupId} groupId={groupId as string} />;
}

function GroupDetail({ groupId }: { groupId: string }) {
  const trpc = useTRPC();
  const invalidate = useInvalidateExpenseData();
  const undo = useUndo();
  const { currentUserId } = useCurrentUser();
  const { newExpenseId, markNewExpense } = useAppDialogs();
  const detail = useQuery(trpc.groups.detail.queryOptions({ groupId }));
  const [tab, setTab] = useState(TABS[0]);
  const [formOpen, setFormOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [deletedName, setDeletedName] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const optionsRef = useRef<HTMLButtonElement>(null);

  const deleteExpense = useMutation(
    trpc.expenses.delete.mutationOptions({
      meta: { errorTitle: "Couldn’t Delete Expense" },
      onSuccess: (_result, { expenseId }) => {
        invalidate();
        const expense = detail.data?.expenses.find((candidate) => candidate.id === expenseId);
        notify.success({
          title: "Expense Deleted",
          body: `“${expense?.description}” was removed and balances updated.`,
          onUndo: () => undo(() => trpcClient.expenses.restore.mutate({ expenseId })),
        });
      },
    })
  );
  const createSettlement = useMutation(
    trpc.settlements.create.mutationOptions({
      meta: { errorTitle: "Couldn’t Record Payment" },
      onSuccess: (settlement) => {
        invalidate();
        notify.success({
          title: "Payment Recorded",
          body: `${nameOf(settlement.fromUserId)} paid ${nameOf(settlement.toUserId)} ${formatCents(settlement.amountCents)}.`,
          onUndo: () => undo(() => trpcClient.settlements.delete.mutate({ settlementId: settlement.id })),
        });
      },
    })
  );
  const deleteSettlement = useMutation(
    trpc.settlements.delete.mutationOptions({
      meta: { errorTitle: "Couldn’t Delete Payment" },
      onSuccess: (_result, { settlementId }) => {
        invalidate();
        notify.success({
          title: "Payment Deleted",
          body: "The debt is back on the balances.",
          onUndo: () => undo(() => trpcClient.settlements.restore.mutate({ settlementId })),
        });
      },
    })
  );
  const archive = useMutation(
    trpc.groups.archive.mutationOptions({
      meta: { errorTitle: "Couldn’t Archive Group" },
      onSuccess: (group) => {
        invalidate();
        notify.success({
          title: "Group Archived",
          body: `${group.name} is hidden from your dashboard.`,
          onUndo: () => undo(() => trpcClient.groups.unarchive.mutate({ groupId })),
        });
      },
    })
  );
  const unarchive = useMutation(
    trpc.groups.unarchive.mutationOptions({
      meta: { errorTitle: "Couldn’t Unarchive Group" },
      onSuccess: (group) => {
        invalidate();
        notify.success({ title: "Group Unarchived", body: `${group.name} is back on your dashboard.` });
      },
    })
  );
  const removeGroup = useMutation(
    trpc.groups.delete.mutationOptions({
      meta: { errorTitle: "Couldn’t Delete Group" },
      onSuccess: () => {
        const name = detail.data?.group.name ?? "This group";
        setDeletedName(name);
        invalidate();
        notify.info({ title: "Group Deleted", body: `${name} and its history were deleted.` });
      },
    })
  );

  const data = detail.data;
  const everyone = data ? [...data.members, ...data.formerMembers] : [];
  const nameOf = (userId: string) => everyone.find((person) => person.id === userId)?.name ?? "Unknown";
  const loading = detail.isLoading;
  const myNet = data?.balances.find((balance) => balance.userId === currentUserId)?.netCents ?? 0;
  const totalCents = data?.expenses.reduce((sum, expense) => sum + expense.amountCents, 0) ?? 0;
  const readOnly = Boolean(data?.group.archivedAt);
  const groupName = deletedName ?? data?.group.name ?? "";

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
      onConfirm: () => deleteExpense.mutate({ expenseId }),
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
  const askDeletePayment = (settlement: Detail["settlements"][number]) =>
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
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <Breadcrumb current={groupName || "Group"} />
        <HeaderActions className="flex-[0_1_560px]" />
      </div>
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
                    {initialOf(member.name)}
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
          expense={editing}
          onClose={() => setFormOpen(false)}
          onSaved={(expenseId) => {
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
