import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { useTRPC } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "server/src/lib/db.js";

export function ManageMembers({
  groupId,
  members,
}: {
  groupId: string;
  members: User[];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: allUsers } = useQuery(trpc.users.list.queryOptions());
  const [selectedUserId, setSelectedUserId] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.groups.detail.queryKey({ groupId }) });

  const addMember = useMutation(
    trpc.groups.addMember.mutationOptions({
      onSuccess: () => {
        invalidate();
        setSelectedUserId("");
      },
    })
  );

  const removeMember = useMutation(
    trpc.groups.removeMember.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const nonMembers = (allUsers ?? []).filter((u) => !members.some((m) => m.id === u.id));

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs">
                  {member.name.charAt(0)}
                </span>
              )}
              {member.name}
            </span>
            <button
              type="button"
              aria-label={`Remove ${member.name}`}
              onClick={() => removeMember.mutate({ groupId, userId: member.id })}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {nonMembers.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Add someone…" />
            </SelectTrigger>
            <SelectContent>
              {nonMembers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!selectedUserId || addMember.isPending}
            onClick={() => addMember.mutate({ groupId, userId: selectedUserId })}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
