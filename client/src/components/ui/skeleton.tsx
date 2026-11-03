import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Placeholder block the same size as the content it stands in for. `onScreen` is for the green ground. */
export function Skeleton({
  width,
  height,
  line,
  round,
  onScreen,
  radius,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  line?: boolean;
  round?: boolean;
  onScreen?: boolean;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "app-skel",
        line && "app-skel--line",
        round && "app-skel--round",
        onScreen && "app-skel--screen",
        className
      )}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}
