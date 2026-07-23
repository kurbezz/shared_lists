import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[72px] resize-y w-full rounded-md border border-input-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
        "disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30",
        "md:text-sm text-base",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
