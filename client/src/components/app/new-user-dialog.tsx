import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
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

export function NewUserDialog() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const createUser = useMutation(
    trpc.users.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.users.list.queryKey() });
        setOpen(false);
        setName("");
        setEmail("");
        setUsername("");
        setPassword("");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && username.trim().length > 0 && password.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-sm text-muted-foreground underline">
          Add a person
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-user-name">Name</Label>
            <Input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-email">Email</Label>
            <Input id="new-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-username">Username</Label>
            <Input id="new-user-username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-password">Password</Label>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!canSubmit || createUser.isPending}
            onClick={() =>
              createUser.mutate({ name: name.trim(), email: email.trim(), username: username.trim(), password })
            }
          >
            {createUser.isPending ? "Adding…" : "Add person"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
