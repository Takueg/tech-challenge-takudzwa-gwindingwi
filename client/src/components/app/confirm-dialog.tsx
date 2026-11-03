import type { ReactNode } from "react";
import { Dialog, DialogCard, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DIALOG_BUTTON = "min-w-0 flex-[1_1_160px] px-2";

/** The system Dialog, centred. Only for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  question,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  question: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogCard className="swl-dialog">
        <DialogTitle className="swl-dialog__title">{title}</DialogTitle>
        <DialogDescription className="swl-dialog__q">{question}</DialogDescription>
        {body && <div className="swl-dialog__body">{body}</div>}
        <div className="swl-dialog__actions">
          <Button variant="secondary" className={DIALOG_BUTTON} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            className={DIALOG_BUTTON}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" width={218} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
        </div>
      </DialogCard>
    </Dialog>
  );
}
