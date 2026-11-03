import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { formatCents } from "@/lib/format";

export function Leaderboard() {
  const trpc = useTRPC();
  const { data: leaderboard } = useQuery(trpc.stats.leaderboard.queryOptions());

  if (!leaderboard || leaderboard.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">Top spenders</h2>
      <ol className="space-y-1 rounded-md border p-3 text-sm">
        {leaderboard.slice(0, 5).map((entry, i) => (
          <li key={entry.userId} className="flex items-center justify-between">
            <span>
              {i + 1}. {entry.userName}
            </span>
            <span className="font-medium">{formatCents(entry.totalCents)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
