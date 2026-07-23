"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 rounded-[4px] border border-input-border bg-surface transition-colors duration-150 hover:border-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-1",
        "data-[state=checked]:border-accent-solid data-[state=checked]:bg-accent-solid data-[state=checked]:text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
      >
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
