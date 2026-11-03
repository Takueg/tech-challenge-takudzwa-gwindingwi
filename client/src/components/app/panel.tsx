import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** A sunken card with an optional title and actions. */
export function Panel({
  title,
  actions,
  className,
  children,
  ...props
}: Omit<ComponentProps<"section">, "title"> & { title?: ReactNode; actions?: ReactNode }) {
  const titleId = useId();
  return (
    <section className={cn("swl-panel", className)} aria-labelledby={title ? titleId : undefined} {...props}>
      {(title || actions) && (
        <div className="swl-panel__head">
          {title && (
            <h2 id={titleId} className="swl-panel__title">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
