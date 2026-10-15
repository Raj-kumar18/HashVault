import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 tracking-wide select-none",
  {
    variants: {
      variant: {
        default:
          "border-zinc-700 bg-white text-zinc-950 font-bold shadow hover:bg-zinc-100",
        secondary:
          "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
        destructive:
          "border-red-500/40 bg-red-950/70 text-red-300 font-semibold shadow hover:bg-red-900/60",
        outline:
          "border-zinc-700 text-zinc-300 hover:bg-zinc-900",
        success:
          "border-emerald-500/40 bg-emerald-950/70 text-emerald-300 font-semibold shadow hover:bg-emerald-900/60",
        warning:
          "border-amber-500/40 bg-amber-950/70 text-amber-300 font-semibold shadow hover:bg-amber-900/60",
        cyan:
          "border-zinc-700 bg-zinc-900 text-zinc-100 font-medium hover:bg-zinc-800",
        purple:
          "border-zinc-700 bg-zinc-900 text-zinc-100 font-medium hover:bg-zinc-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
