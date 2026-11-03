import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Icon } from "@/components/ui/icon";

/** 26px box with radius 8, and its label as part of the click target. */
function Checkbox({
  label,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & { label?: React.ReactNode }) {
  return (
    <label className="swl-check">
      <CheckboxPrimitive.Root data-slot="checkbox" className="swl-check__box" {...props}>
        <CheckboxPrimitive.Indicator className="flex">
          <Icon name="check" size={16} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && <span className="swl-check__label">{label}</span>}
    </label>
  );
}

export { Checkbox };
