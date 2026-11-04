import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** Centred icon, title and line, for a panel with nothing to show. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  round,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
  round?: boolean;
}) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 px-4 py-9 text-center">
      <span
        aria-hidden="true"
        className={
          round
            ? "flex size-16 items-center justify-center rounded-full bg-primary text-ink"
            : "flex size-16 items-center justify-center rounded-[22px] bg-honeydew text-ink"
        }
      >
        <Icon name={icon} size={28} />
      </span>
      <h3 className="m-0 type-p600-17-24 text-strong">{title}</h3>
      <p className="m-0 type-s400-14-20 text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

/** A query failed. Says the data is safe and offers a retry. */
export function ErrorState({
  title,
  onRetry,
  showBack,
}: {
  title: string;
  onRetry: () => void;
  showBack?: boolean;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-9 text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-[22px] bg-danger-soft text-danger"
      >
        <Icon name="cloud_off" size={28} />
      </span>
      <h3 className="m-0 type-p600-17-24 text-strong">{title}</h3>
      <p className="m-0 type-s400-14-20 text-muted-foreground">
        It might be a connection problem. Your data is safe.
      </p>
      <Button onClick={onRetry}>Try Again</Button>
      {showBack && (
        <Link to="/" className="app-link">
          Back to dashboard
        </Link>
      )}
    </div>
  );
}
