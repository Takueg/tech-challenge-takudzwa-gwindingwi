import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const buttonVariants = cva("", {
  variants: {
    variant: {
      primary: "swl-btn swl-btn--primary",
      secondary: "swl-btn swl-btn--secondary",
      outline: "app-textbtn app-textbtn--outline",
      danger: "app-textbtn app-textbtn--danger",
      text: "app-textbtn",
      icon: "app-iconbtn",
    },
  },
  defaultVariants: { variant: "primary" },
});

function Button({
  className,
  variant,
  asChild = false,
  type = "button",
  width,
  block,
  style,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    width?: number;
    block?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant }), block && "swl-btn--block", className)}
      style={width ? { width, ...style } : style}
      {...props}
    />
  );
}

export { Button };
