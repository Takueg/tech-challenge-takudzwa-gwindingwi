import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export type SelectOption = { value: string; label: string };

/** 41px trigger with a light-green list. `inPanel` gives the list the white fill fields get inside panels. */
function Select({
  options,
  value,
  onValueChange,
  placeholder,
  invalid,
  inPanel,
  disabled,
  id,
  className,
  ...aria
}: {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  inPanel?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
} & Pick<React.AriaAttributes, "aria-label" | "aria-labelledby" | "aria-describedby">) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select-trigger"
        className={cn("swl-select__trigger", invalid && "app-invalid", className)}
        aria-invalid={invalid ? true : undefined}
        {...aria}
      >
        <span className="swl-select__value">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon className="swl-select__chev">
          <Icon name="expand_more" size={12} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={cn("swl-select__list", inPanel && "swl-select__list--panel")}
        >
          <SelectPrimitive.Viewport className="swl-select__viewport">
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value} className="swl-select__opt">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { Select };
