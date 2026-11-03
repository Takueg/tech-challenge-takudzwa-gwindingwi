import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { UnarchiveGroupButton } from "@/components/app/unarchive-group-button";

export function ArchivedGroups() {
  const trpc = useTRPC();
  const { data: archivedGroups } = useQuery(trpc.groups.listArchived.queryOptions());

  if (!archivedGroups || archivedGroups.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">Archived groups</h2>
      <ul className="divide-y rounded-md border">
        {archivedGroups.map((group) => (
          <li key={group.id} className="flex items-center justify-between gap-4 p-3 text-sm">
            <span>{group.name}</span>
            <UnarchiveGroupButton groupId={group.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
