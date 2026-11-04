import { Initial } from "@/components/app/group/initial";
import { Panel } from "@/components/app/panel";
import { Button } from "@/components/ui/button";
import { useCurrentUserId } from "@/context/current-user";
import { useRemoveMember } from "@/hooks/use-group-actions";
import { formatCents } from "@/lib/format";
import type { RouterOutputs } from "@/lib/trpc";

type Detail = RouterOutputs["groups"]["detail"];

export function MembersTab({ data, readOnly }: { data: Detail; readOnly: boolean }) {
  const currentUserId = useCurrentUserId();
  const { group, members, balances } = data;
  const netOf = (userId: string) => balances.find((balance) => balance.userId === userId)?.netCents ?? 0;

  const nameOf = (userId: string) => members.find((member) => member.id === userId)?.name ?? "They";
  const remove = useRemoveMember(group.name, nameOf);

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
              <span className="type-p500-15-20">
                {member.id === currentUserId ? `${member.name} (You)` : member.name}
              </span>
              <span className="type-p400-13-18 text-muted-foreground">
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
