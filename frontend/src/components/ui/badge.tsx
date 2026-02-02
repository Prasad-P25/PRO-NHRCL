import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        compliant:
          "border-transparent bg-compliant/10 text-compliant",
        nonCompliant:
          "border-transparent bg-non-compliant/10 text-non-compliant",
        notApplicable:
          "border-transparent bg-not-applicable/10 text-not-applicable",
        notVerified:
          "border-transparent bg-not-verified/10 text-not-verified",
        inProgress:
          "border-transparent bg-in-progress/10 text-in-progress",
        pending:
          "border-transparent bg-pending/10 text-pending",
        critical:
          "border-transparent bg-critical/10 text-critical",
        major:
          "border-transparent bg-major/10 text-major",
        minor:
          "border-transparent bg-minor/10 text-minor",
        observation:
          "border-transparent bg-observation/10 text-observation",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
