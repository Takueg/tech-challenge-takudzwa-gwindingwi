import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useMyArchivedGroups } from "@/hooks/use-data";
import { useUnarchiveGroup } from "@/hooks/use-group-actions";

export function ArchivedGroups() {
  const { data: archived } = useMyArchivedGroups();
  const unarchive = useUnarchiveGroup();

  if (!archived?.length) return null;

  return (
    <details className="group flex flex-col gap-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 type-p600-15-20 text-strong">
        <Icon name="expand_more" size={20} className="transition-transform group-open:rotate-180" />
        Archived ({archived.length})
      </summary>
      <ul className="app-sunken m-0 mt-3 flex list-none flex-col gap-2 rounded-[22px] bg-sunken p-4">
        {archived.map((group) => (
          <li key={group.id} className="flex flex-wrap items-center gap-3.5 px-1">
            <Icon name="archive" size={20} />
            <Link to={`/groups/${group.id}`} className="min-w-0 flex-1 truncate type-p500-15-20 text-foreground">
              {group.name}
            </Link>
            <Button
              variant="secondary"
              disabled={unarchive.isPending}
              onClick={() => unarchive.mutate({ groupId: group.id })}
            >
              Unarchive
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
