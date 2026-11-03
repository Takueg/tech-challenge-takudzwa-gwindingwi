import { cn } from "@/lib/utils";

/** A Material Symbols Rounded glyph. `name` is the ligature; without `label` it's decorative. */
export function Icon({
  name,
  size = 24,
  label,
  className,
}: {
  name: string;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("app-icon", className)}
      style={{ fontSize: size, width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      translate="no"
    >
      {name}
    </span>
  );
}
