import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTRPC } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { useCurrentUser } from "@/context/current-user";
import { formatCents } from "@/lib/format";
import { shareOf } from "@/lib/share";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AddExpenseDialog } from "@/components/app/add-expense-dialog";
import { SettleUpDialog } from "@/components/app/settle-up-dialog";
import { ManageMembers } from "@/components/app/manage-members";
import { EditExpenseDialog } from "@/components/app/edit-expense-dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { UnarchiveGroupButton } from "@/components/app/unarchive-group-button";

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const invalidateExpenseData = useInvalidateExpenseData();
  const { currentUserId } = useCurrentUser();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [cantDeleteOpen, setCantDeleteOpen] = useState(false);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [undoTarget, setUndoTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery(trpc.groups.detail.queryOptions({ groupId: groupId! }));

  const deleteGroup = useMutation(
    trpc.groups.delete.mutationOptions({
      onSuccess: () => {
        invalidateExpenseData();
        navigate("/");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const archiveGroup = useMutation(
    trpc.groups.archive.mutationOptions({
      onSuccess: () => {
        invalidateExpenseData();
        navigate("/");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const deleteExpense = useMutation(
    trpc.expenses.delete.mutationOptions({
      onSuccess: () => {
        invalidateExpenseData();
        toast.success("Expense deleted");
      },
      onError: () => {
        toast.error("Couldn't delete expense");
      },
    })
  );

  const undoSettlement = useMutation(
    trpc.settlements.delete.mutationOptions({
      onSuccess: () => {
        invalidateExpenseData();
        toast.success("Settlement undone");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  function handleDelete(expenseId: string, paidByUserId: string) {
    if (paidByUserId !== currentUserId) {
      setCantDeleteOpen(true);
      return;
    }
    setDeleteTarget(expenseId);
  }

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;

  const { group, members, expenses, balances, suggestedTransfers, categoryTotals } = data;
  const nameOf = (userId: string) => members.find((m) => m.id === userId)?.name ?? "Unknown";
  const headerTotalCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const categoryTotalCents = Object.values(categoryTotals).reduce((sum, c) => sum + c, 0);

  if (group.archivedAt) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          This group is archived, so its expenses are hidden. Unarchive it to see them again.
        </p>
        <UnarchiveGroupButton groupId={group.id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">{members.map((m) => m.name).join(", ")}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatCents(headerTotalCents)}</p>
          <p className="text-xs text-muted-foreground">spent</p>
        </div>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex items-center justify-between">
            <a
              href={`/export/groups/${group.id}.csv`}
              className="text-sm text-muted-foreground underline"
              download
            >
              Export CSV
            </a>
            <AddExpenseDialog groupId={group.id} members={members} />
          </div>
          <div className="divide-y rounded-md border">
            {expenses.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No expenses yet.</p>
            )}
            {expenses.map((expense) => {
              const share = shareOf(expense, currentUserId);
              return (
                <div key={expense.id} className="flex items-center justify-between gap-4 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{expense.description}</p>
                      <Badge variant="secondary">{expense.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {nameOf(expense.paidByUserId)} paid ·{" "}
                      {new Date(expense.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                    {share !== undefined && (
                      <p className="text-xs text-muted-foreground">Your share: {formatCents(share)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCents(expense.amountCents)}</span>
                    <EditExpenseDialog
                      expenseId={expense.id}
                      currentDescription={expense.description}
                      currentAmountCents={expense.amountCents}
                      currentReceiptUrl={expense.receiptUrl}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete expense"
                      onClick={() => handleDelete(expense.id, expense.paidByUserId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="balances" className="space-y-4">
          <div className="rounded-md border p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">Net balances</h2>
              <span className="text-xs text-muted-foreground">
                Total group spending: {formatCents(categoryTotalCents)}
              </span>
            </div>
            <ul className="space-y-1">
              {balances.map((b) => (
                <li key={b.userId} className="flex items-center justify-between text-sm">
                  <span>{nameOf(b.userId)}</span>
                  <span
                    className={
                      b.netCents > 0
                        ? "font-medium text-emerald-600"
                        : b.netCents < 0
                          ? "font-medium text-red-600"
                          : "text-muted-foreground"
                    }
                  >
                    {b.netCents === 0
                      ? "settled up"
                      : b.netCents > 0
                        ? `is owed ${formatCents(b.netCents)}`
                        : `owes ${formatCents(-b.netCents)}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Suggested settlements</h2>
            {suggestedTransfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone is settled up. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {suggestedTransfers.map((t, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>
                      {nameOf(t.fromUserId)} → {nameOf(t.toUserId)}:{" "}
                      <span className="font-medium">{formatCents(t.amountCents)}</span>
                    </span>
                    <SettleUpDialog
                      groupId={group.id}
                      transfer={t}
                      fromName={nameOf(t.fromUserId)}
                      toName={nameOf(t.toUserId)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Settlement history</h2>
            {data.settlements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No settlements recorded yet.</p>
            ) : (
              <ul className="space-y-1">
                {data.settlements.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                    <span>
                      {nameOf(s.fromUserId)} paid {nameOf(s.toUserId)} {formatCents(s.amountCents)} on{" "}
                      {new Date(s.createdAt).toLocaleDateString("de-DE")}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setUndoTarget(s.id)}>
                      Undo
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Spending by category</h2>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(categoryTotals).map(([category, cents]) => (
                  <tr key={category}>
                    <td className="py-1">{category}</td>
                    <td className="py-1 text-right text-muted-foreground">{formatCents(cents)}</td>
                  </tr>
                ))}
                <tr className="border-t font-bold">
                  <td className="py-1">Total</td>
                  <td className="py-1 text-right">{formatCents(categoryTotalCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <ManageMembers groupId={group.id} members={members} />

          <Separator />

          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Danger zone</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => archiveGroup.mutate({ groupId: group.id })}
                className="rounded border-2 border-emerald-600 px-3 py-1.5 text-sm font-medium uppercase tracking-wide text-emerald-700 hover:bg-emerald-50"
              >
                Archive group
              </button>
              <Button variant="destructive" onClick={() => setDeleteGroupOpen(true)}>
                Delete group
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this expense?"
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && deleteExpense.mutate({ expenseId: deleteTarget })}
      />

      <ConfirmDialog
        open={undoTarget !== null}
        onOpenChange={(open) => !open && setUndoTarget(null)}
        title="Undo this settlement?"
        description="The debt goes back on the balances."
        confirmLabel="Undo settlement"
        destructive
        onConfirm={() => undoTarget && undoSettlement.mutate({ settlementId: undoTarget })}
      />

      <ConfirmDialog
        open={cantDeleteOpen}
        onOpenChange={setCantDeleteOpen}
        title="You can't delete this expense"
        description="Only the person who paid can delete it."
        confirmLabel="OK"
        hideCancel
      />

      <ConfirmDialog
        open={deleteGroupOpen}
        onOpenChange={setDeleteGroupOpen}
        title={`Delete "${group.name}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteGroup.mutate({ groupId: group.id })}
      />
    </div>
  );
}
