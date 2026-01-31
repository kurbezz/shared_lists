import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  buttonVariants,
  type ButtonVariantProps,
} from "@/components/ui/button-variants";

import { cn } from "@/lib/utils";

// Variants are defined in a separate module to keep this file focused on the
// Button component (prevents \"react-refresh/only-export-components\" lint errors).

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  ButtonVariantProps & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button };
