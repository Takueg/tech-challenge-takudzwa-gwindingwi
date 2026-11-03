import type { ComponentProps, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} className="app-err">
      <Icon name="error" size={16} className="mt-px" />
      {children}
    </span>
  );
}

/** Label, input, then an error line, or a hint when there's no error. */
export function TextField({
  id,
  label,
  error,
  hint,
  ...input
}: Omit<ComponentProps<typeof Input>, "id" | "invalid"> & {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
}) {
  const messageId = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="swl-field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} invalid={Boolean(error)} aria-describedby={messageId} autoComplete="off" {...input} />
      {error ? (
        <FieldError id={messageId}>{error}</FieldError>
      ) : hint ? (
        <span id={messageId} className="app-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Red banner for a failure the form can't pin on one field. */
export function ErrorBanner({ icon = "wifi_off", title, children }: { icon?: string; title: string; children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[18px] bg-danger-soft px-4 py-3.5 text-danger-ink">
      <Icon name={icon} size={20} />
      <span className="flex flex-col gap-0.5 [font:400_13px/18px_var(--font-poppins)]">
        <strong className="[font:600_14px/20px_var(--font-poppins)]">{title}</strong>
        {children}
      </span>
    </div>
  );
}

/** The red "Fix the 2 highlighted fields…" line above a dialog's buttons. */
export function FormSummary({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="m-0 text-center [font:500_13px/18px_var(--font-poppins)] text-danger">
      {children}
    </p>
  );
}

/** Dialog buttons: primary stacked above secondary, each 218px. */
export function DialogActions({
  submitLabel,
  pending,
  onCancel,
  cancelLabel = "Cancel",
}: {
  submitLabel: string;
  pending?: boolean;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Button type="submit" width={218} disabled={pending}>
        {submitLabel}
      </Button>
      <Button variant="secondary" width={218} onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  );
}
