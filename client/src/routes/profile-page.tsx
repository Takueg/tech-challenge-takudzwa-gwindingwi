import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useCurrentUser } from "@/context/current-user";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProfilePage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { currentUserId } = useCurrentUser();
  const { data: users } = useQuery(trpc.users.list.queryOptions());
  const user = users?.find((u) => u.id === currentUserId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setBio(user.bio ?? "");
    }
  }, [user]);

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: trpc.users.list.queryKey() });

  const updateUser = useMutation(
    trpc.users.update.mutationOptions({
      onSuccess: invalidateUsers,
    })
  );

  const updateAvatar = useMutation(
    trpc.users.updateAvatar.mutationOptions({
      onSuccess: invalidateUsers,
    })
  );

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateAvatar.mutate({ userId: user.id, avatarUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  }

  if (!user) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-sm space-y-3">
      <h1 className="text-xl font-semibold">Profile</h1>

      <div className="flex items-center gap-3">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-medium">
            {user.name.charAt(0)}
          </div>
        )}
        <div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Change photo
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">Name</p>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Email</p>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Bio</p>
        <textarea
          className="w-full rounded-md border p-2 text-sm"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>
      <Button onClick={() => updateUser.mutate({ userId: user.id, name, email, bio })}>Save</Button>
    </div>
  );
}
