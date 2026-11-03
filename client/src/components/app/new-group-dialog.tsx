import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NewUserDialog } from "@/components/app/new-user-dialog";

export function NewGroupDialog() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: users } = useQuery(trpc.users.list.queryOptions());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const createGroup = useMutation(
    trpc.groups.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.groups.list.queryKey() });
        setOpen(false);
        setName("");
        setMemberIds([]);
      },
    })
  );

  const canSubmit = name.trim().length > 0 && memberIds.length > 0;

  function toggleMember(userId: string) {
    setMemberIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">New group</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ski trip, Apartment 4B…"
            />
          </div>
          <div className="space-y-2">
            <Label>Members</Label>
            <div className="space-y-2 rounded-md border p-3">
              {users?.map((user) => (
                <div key={user.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`member-${user.id}`}
                    checked={memberIds.includes(user.id)}
                    onCheckedChange={() => toggleMember(user.id)}
                  />
                  <Label htmlFor={`member-${user.id}`} className="font-normal">
                    {user.name}
                  </Label>
                </div>
              ))}
            </div>
            <NewUserDialog />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!canSubmit || createGroup.isPending}
            onClick={() => createGroup.mutate({ name: name.trim(), memberIds })}
          >
            {createGroup.isPending ? "Creating…" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
