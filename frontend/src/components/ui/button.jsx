import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-zinc-950 font-semibold shadow hover:bg-zinc-200 active:bg-zinc-300",
        destructive:
          "bg-red-600 text-white font-semibold shadow-sm hover:bg-red-500 active:bg-red-700",
        success:
          "bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-500 active:bg-emerald-700",
        outline:
          "border border-zinc-700 bg-zinc-900/90 text-zinc-100 shadow-sm hover:bg-zinc-800 hover:border-zinc-600 hover:text-white",
        secondary:
          "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm hover:bg-zinc-700 active:bg-zinc-900",
        ghost:
          "text-zinc-300 hover:bg-zinc-800 hover:text-white",
        link:
          "text-zinc-200 underline-offset-4 hover:underline hover:text-white font-medium",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
