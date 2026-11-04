import { HalfPieChart } from "@/components/app/half-pie-chart";
import { Panel } from "@/components/app/panel";
import { ErrorState } from "@/components/app/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserId } from "@/context/current-user";
import { barPercent, toPieSlices, type SpenderRow } from "@/lib/charts";
import { formatCents } from "@/lib/format";

type Query = { loading?: boolean; error?: boolean; onRetry?: () => void };

function SpendingByCategory({
  categoryTotals,
  loading,
  error,
  onRetry,
}: Query & { categoryTotals: Record<string, number> }) {
  const slices = toPieSlices(categoryTotals);
  return (
    <Panel title="Spending By Category">
      {loading ? (
        <div aria-hidden="true" className="flex flex-col items-center gap-[22px] pt-1.5">
          <Skeleton width={290} height={145} radius="145px 145px 0 0" />
          <span className="flex gap-[18px]">
            <Skeleton line width={64} />
            <Skeleton line width={64} />
            <Skeleton line width={96} />
          </span>
        </div>
      ) : error ? (
        <ErrorState title="We Couldn’t Load This Chart" onRetry={() => onRetry?.()} />
      ) : slices.length === 0 ? (
        <p className="m-0 type-s400-14-20 text-muted-foreground">Nothing has been spent yet.</p>
      ) : (
        <div className="flex justify-center">
          <HalfPieChart data={slices} />
        </div>
      )}
    </Panel>
  );
}

function TopSpenders({
  spenders,
  label,
  loading,
  error,
  onRetry,
  skeletonRows,
}: Query & { spenders: SpenderRow[]; label: string; skeletonRows: number }) {
  const currentUserId = useCurrentUserId();
  const top = spenders.slice(0, 5);
  const topCents = top[0]?.totalCents ?? 0;
  return (
    <Panel title="Top Spenders">
      {loading ? (
        <div aria-hidden="true" className="flex flex-col gap-3.5">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <div key={i} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
              <Skeleton line width={10} height={12} />
              <Skeleton line width={110} />
              <Skeleton line width={72} />
              <Skeleton height={8} radius={4} className="col-[2/4]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="We Couldn’t Load Top Spenders" onRetry={() => onRetry?.()} />
      ) : top.length === 0 ? (
        <p className="m-0 type-s400-14-20 text-muted-foreground">
          Nobody has paid for anything yet.
        </p>
      ) : (
        <ol aria-label={label} className="m-0 flex list-none flex-col gap-3.5 p-0">
          {top.map((spender, index) => (
            <li key={spender.userId} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
              <span className="type-p600-13-1 text-muted-foreground">{index + 1}</span>
              <span className="type-p500-15-1 text-foreground">
                {spender.userId === currentUserId ? `${spender.userName} (You)` : spender.userName}
              </span>
              <span className="type-p500-15-1 text-strong">
                {formatCents(spender.totalCents)}
              </span>
              <svg aria-hidden="true" width="100%" height="8" className="col-[2/4] block">
                <rect x="0" y="0" width="100%" height="8" rx="4" fill="#f1fff3" />
                <rect
                  x="0"
                  y="0"
                  width={`${barPercent(spender.totalCents, topCents)}%`}
                  height="8"
                  rx="4"
                  fill="#00d09e"
                />
              </svg>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function SpendingPanels({
  categoryTotals,
  spenders,
  spendersLabel,
  skeletonRows = 5,
  ...query
}: Query & {
  categoryTotals: Record<string, number>;
  spenders: SpenderRow[];
  spendersLabel: string;
  skeletonRows?: number;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-stretch gap-6">
      <SpendingByCategory categoryTotals={categoryTotals} {...query} />
      <TopSpenders spenders={spenders} label={spendersLabel} skeletonRows={skeletonRows} {...query} />
    </div>
  );
}
