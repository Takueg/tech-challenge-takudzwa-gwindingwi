import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { formatCents } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Group } from "server/src/lib/db.js";

export function ExpenseSearch({ groups }: { groups: Group[] }) {
  const trpc = useTRPC();
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data: results } = useQuery({
    ...trpc.expenses.search.queryOptions({ query: submittedQuery }),
    enabled: submittedQuery.trim().length > 0,
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Search expenses…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSubmittedQuery(inputValue);
          }}
        />
        <Button variant="outline" onClick={() => setSubmittedQuery(inputValue)}>
          Search
        </Button>
      </div>
      {results && (
        <div className="divide-y rounded-md border">
          {results.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No expenses match "{submittedQuery}".</p>
          )}
          {results.map((expense) => {
            const group = groups.find((g) => g.id === expense.groupId);
            return (
              <div key={expense.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <div>
                  <span className="font-medium">{expense.description}</span>{" "}
                  <Badge variant="secondary">{expense.category}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {expense.paidByUserName} paid in {group?.name ?? "a group"}
                  </p>
                </div>
                <span className="font-medium">{formatCents(expense.amountCents)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
