import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "react-select";
import { useTRPC } from "@/lib/trpc";
import { useCurrentUser } from "@/context/current-user";
import { parseAmountToCents } from "@/lib/parse-amount";
import { Input } from "@/components/ui/input";
import type { Group } from "server/src/lib/db.js";

export function QuickAddExpense({ groups }: { groups: Group[] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { currentUserId } = useCurrentUser();
  const [groupId, setGroupId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const quickAdd = useMutation(
    trpc.quickAdd.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.groups.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.stats.overview.queryKey() });
        setDescription("");
        setAmount("");
      },
    })
  );

  const amountCents = parseAmountToCents(amount);
  const canSubmit = groupId && description.trim().length > 0 && amountCents > 0 && currentUserId;

  const groupOptions = groups.map((group) => ({ value: group.id, label: group.name }));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
      <div className="w-40">
        <Select
          options={groupOptions}
          placeholder="Group"
          onChange={(option) => setGroupId(option?.value ?? "")}
          value={groupOptions.find((o) => o.value === groupId) ?? null}
        />
      </div>
      <Input
        className="w-40"
        placeholder="What was it?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input className="w-24" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button
        type="button"
        disabled={!canSubmit || quickAdd.isPending}
        onClick={() =>
          currentUserId &&
          quickAdd.mutate({ groupId, description: description.trim(), amountCents, paidByUserId: currentUserId })
        }
        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Quick add
      </button>
    </div>
  );
}
