import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** 171×101 card on the green header. Label and amount are centred, with no icon. */
export function SummaryCard({
  label,
  amount,
  expense,
}: {
  label: string;
  amount: string;
  expense?: boolean;
}) {
  return (
    <div className={cn("swl-sum flex-none", expense && "swl-sum--expense")}>
      <span className="swl-sum__label">{label}</span>
      <span className="swl-sum__amount">{amount}</span>
    </div>
  );
}

export function SummaryCardSkeleton() {
  return <Skeleton onScreen width={171} height={101} radius="var(--radius-14)" />;
}
