import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

/** Overlay plus a raw card. The overlay is the scroller, so tall dialogs can be scrolled whole. */
function DialogCard({
  className,
  width,
  top,
  style,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { width?: number; top?: boolean }) {
  // Radix only returns focus to its own Trigger, and these dialogs are opened from code.
  const [opener] = React.useState(() => document.activeElement as HTMLElement | null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 flex justify-center overflow-y-auto bg-[var(--overlay)] px-4",
          top ? "items-start pt-[12vh] pb-4" : "items-center py-6"
        )}
      >
        <DialogPrimitive.Content
          className={cn("max-w-full outline-none", !top && "my-auto", className)}
          style={{ width, ...style }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener?.focus();
          }}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
}

/** Form dialog anatomy: white card, radius 20, padding 32/32/28, title, subtitle and a 44px close. */
function DialogContent({
  title,
  subtitle,
  width = 480,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof DialogCard>, "title"> & { title: string; subtitle?: React.ReactNode }) {
  return (
    <DialogCard
      width={width}
      className={cn("flex flex-col gap-[18px] rounded-[20px] bg-dialog px-8 pt-8 pb-7 text-foreground", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <DialogPrimitive.Title className="m-0 [font:700_20px/30px_var(--font-poppins)] text-dialog-title">
            {title}
          </DialogPrimitive.Title>
          {subtitle ? (
            <DialogPrimitive.Description className="m-0 [font:400_15px/20px_var(--font-spartan)] text-dialog-body">
              {subtitle}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close className="app-iconbtn" aria-label="Close">
          <Icon name="close" size={20} />
        </DialogPrimitive.Close>
      </div>
      {children}
    </DialogCard>
  );
}

const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;
const DialogClose = DialogPrimitive.Close;

export { Dialog, DialogCard, DialogContent, DialogTitle, DialogDescription, DialogClose };
