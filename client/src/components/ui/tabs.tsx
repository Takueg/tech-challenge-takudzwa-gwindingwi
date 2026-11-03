import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/** The 60px segmented track. */
function SegmentedControl({
  options,
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsPrimitive.List>, "children"> & { options: string[] }) {
  return (
    <TabsPrimitive.List className={cn("swl-seg", options.length === 2 && "swl-seg--n2", className)} {...props}>
      {options.map((option) => (
        <TabsPrimitive.Trigger key={option} value={option} className="swl-seg__tab">
          {option}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
  );
}

/** Stays mounted while hidden, so a table keeps its filters when you switch tabs. */
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      forceMount
      className={cn("data-[state=inactive]:hidden outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, SegmentedControl, TabsContent };
