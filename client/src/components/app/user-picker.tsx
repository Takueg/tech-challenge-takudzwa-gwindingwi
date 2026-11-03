import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useCurrentUser } from "@/context/current-user";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UserPicker() {
  const trpc = useTRPC();
  const { data: users } = useQuery(trpc.users.list.queryOptions());
  const { currentUserId, setCurrentUserId } = useCurrentUser();

  if (!users) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Acting as</span>
      <Select value={currentUserId ?? undefined} onValueChange={setCurrentUserId}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select user" />
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
