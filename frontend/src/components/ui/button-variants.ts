// Shared variants for the Button UI primitive (DESIGN.md §10.1).
//
// Kept in a separate file to avoid the `react-refresh/only-export-components`
// ESLint error (fast refresh expects files that export only React components).
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  // Base (DESIGN.md §10.1): single row, nowrap, functional transitions only.
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 shrink-0",
  {
    variants: {
      variant: {
        // Solid accent fill — primary actions.
        primary:
          "bg-accent-solid text-accent-foreground hover:bg-accent-solid-hover active:bg-accent-solid-hover",
        destructive:
          "bg-destructive text-white hover:bg-destructive-hover active:bg-destructive-hover",
        outline:
          "border border-input-border bg-surface text-foreground hover:bg-subtle active:bg-subtle",
        secondary:
          "bg-subtle text-foreground hover:bg-border active:bg-border",
        ghost:
          "text-secondary-foreground hover:bg-subtle hover:text-foreground active:bg-subtle",
        // Icon-only destructive (hover-reveal delete on rows/cards).
        "ghost-destructive":
          "text-muted-foreground hover:bg-destructive-subtle hover:text-destructive active:bg-destructive-subtle",
        link: "h-auto px-0 text-accent underline-offset-4 hover:underline",
        // Single brand exception — Twitch login button only (DESIGN.md §3.4).
        twitch: "bg-twitch text-white hover:bg-twitch-hover active:bg-twitch-hover",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-sm",
        icon: "h-8 w-8",
        "icon-dense": "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;