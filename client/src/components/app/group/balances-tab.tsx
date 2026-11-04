import { IconTile } from "@/components/app/category-tile";
import { Initial } from "@/components/app/group/initial";
import { Panel } from "@/components/app/panel";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCurrentUserId } from "@/context/current-user";
import { formatCents, formatTimestamp } from "@/lib/format";
import type { RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Detail = RouterOutputs["groups"]["detail"];
export type Transfer = Detail["suggestedTransfers"][number];
export type Payment = Detail["settlements"][number];

export function BalancesTab({
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
  onDeletePayment: (settlement: Payment) => void;
}) {
  const currentUserId = useCurrentUserId();
  const isFormer = (userId: string) => data.formerMembers.some((member) => member.id === userId);
  const display = (userId: string) => (userId === currentUserId ? "You" : nameOf(userId));

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
        <Panel title="Suggested Payments">
          <p className="m-0 type-p400-14-20 text-muted-foreground">
            The fewest payments that settle everyone. Recording one doesn’t move money. Pay outside the app first, then
            record it here.
          </p>
          {data.suggestedTransfers.length === 0 ? (
            <div role="status" className="flex items-center gap-4 rounded-[22px] bg-sheet p-5">
              <span aria-hidden="true" className="flex size-12 flex-none items-center justify-center rounded-full bg-primary text-ink">
                <Icon name="check" size={24} />
              </span>
              <span className="flex flex-col gap-1">
                <strong className="type-p600-16-22 text-strong">Everyone’s Settled Up</strong>
                <span className="type-p400-14-20 text-muted-foreground">
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
                      <span className="type-p500-15-20">{text}</span>
                      <span className="type-p600-17-22 text-accent-ink">
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
            <p className="m-0 type-s400-14-20 text-muted-foreground">
              No payments recorded yet.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {data.settlements.map((settlement) => (
                <li key={settlement.id} className="flex items-center gap-3.5">
                  <IconTile icon="handshake" background="var(--ocean-blue)" />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="type-p500-15-20">
                      {nameOf(settlement.fromUserId)} paid {nameOf(settlement.toUserId)}
                    </span>
                    <span className="swl-row__time">{formatTimestamp(settlement.createdAt)}</span>
                  </span>
                  <span className="type-p500-15-20 text-strong">
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
                <span className="type-p500-15-20">{display(balance.userId)}</span>
                {isFormer(balance.userId) && (
                  <span className="type-p400-12-16 text-muted-foreground">Former member</span>
                )}
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="type-p400-12-16 text-muted-foreground">
                  {balance.netCents > 0 ? "Is Owed" : balance.netCents < 0 ? "Owes" : "Settled Up"}
                </span>
                <span
                  className={cn(
                    "type-p600-15-20",
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
