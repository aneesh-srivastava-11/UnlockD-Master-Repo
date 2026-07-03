import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-background hover:opacity-90 active:scale-98",
        destructive: "bg-danger text-background hover:opacity-90 active:scale-98",
        outline: "border border-border bg-transparent text-text-primary hover:bg-surface active:scale-98",
        secondary: "bg-surface border border-border text-text-primary hover:opacity-90 active:scale-98",
        ghost: "hover:bg-surface hover:text-text-primary",
        link: "text-accent underline-offset-4 hover:underline min-h-0 p-0 font-normal",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded px-3",
        lg: "h-12 rounded px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
