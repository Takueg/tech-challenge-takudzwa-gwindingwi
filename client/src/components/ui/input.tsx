import * as React from "react";
import { cn } from "@/lib/utils";

/** The 41px field box. `suffix` and `trailing` sit inside the box after the input. */
function Input({
  className,
  invalid,
  suffix,
  trailing,
  boxClassName,
  ...props
}: React.ComponentProps<"input"> & {
  invalid?: boolean;
  suffix?: string;
  trailing?: React.ReactNode;
  boxClassName?: string;
}) {
  return (
    <div className={cn("swl-field__box", invalid && "app-invalid", boxClassName)}>
      <input
        data-slot="input"
        className={cn("swl-field__input", className)}
        aria-invalid={invalid ? true : undefined}
        {...props}
      />
      {suffix && (
        <span aria-hidden="true" className="swl-field__suffix">
          {suffix}
        </span>
      )}
      {trailing}
    </div>
  );
}

function Textarea({ className, invalid, ...props }: React.ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <div className={cn("swl-field__box swl-field__box--area", invalid && "app-invalid")}>
      <textarea
        className={cn("swl-field__input swl-field__input--area", className)}
        aria-invalid={invalid ? true : undefined}
        {...props}
      />
    </div>
  );
}

export { Input, Textarea };
