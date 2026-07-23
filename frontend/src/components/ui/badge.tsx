import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-subtle text-secondary-foreground",
        creator: "bg-accent-subtle text-accent",
        editor: "bg-info-subtle text-info",
        viewer: "bg-subtle text-secondary-foreground",
        active: "bg-accent-subtle text-accent",
        revoked: "bg-destructive-subtle text-destructive",
        destructive: "bg-destructive-subtle text-destructive",
        secondary: "bg-subtle text-secondary-foreground",
        outline: "border border-border text-secondary-foreground",
        counter:
          "rounded-full bg-subtle px-2 py-0.5 font-mono text-[11px] tabular-nums text-secondary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge }
