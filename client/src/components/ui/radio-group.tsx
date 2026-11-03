import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

const RadioGroup = RadioGroupPrimitive.Root;

function RadioGroupItem(props: Omit<React.ComponentProps<typeof RadioGroupPrimitive.Item>, "className">) {
  return <RadioGroupPrimitive.Item data-slot="radio" className="swl-radio__dot" {...props} />;
}

export { RadioGroup, RadioGroupItem };
