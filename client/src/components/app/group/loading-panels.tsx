import { Skeleton } from "@/components/ui/skeleton";

export function LoadingPanels() {
  return (
    <div role="status" className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
      <span className="sr-only">Loading…</span>
      {[1, 2, 3].map((n) => (
        <div key={n} aria-hidden="true" className="swl-panel">
          <Skeleton line width={160} height={18} />
          <div className="flex items-center gap-3.5">
            <Skeleton round width={40} height={40} />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton line width="60%" />
              <Skeleton line width="40%" height={10} />
            </span>
          </div>
          <div className="flex items-center gap-3.5">
            <Skeleton round width={40} height={40} />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton line width="52%" />
              <Skeleton line width="34%" height={10} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
