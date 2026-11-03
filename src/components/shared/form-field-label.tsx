"use client"

import { CircleHelp } from "lucide-react"

import { FieldLabel } from "@/components/ui/field"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type FieldOrientation = "vertical" | "horizontal"

// Zoho-style row: label in a fixed column on the left, control on the right; errors and
// descriptions line up under the control. Stacks on small screens.
export const HORIZONTAL_FIELD_CLASS =
  "sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center sm:gap-x-4 sm:*:data-[slot=field-description]:col-start-2 sm:*:data-[slot=field-error]:col-start-2"

type FormFieldLabelProps = {
  htmlFor?: string
  label: string
  // Shows the label in red with an asterisk.
  required?: boolean
  // Short help shown in a tooltip next to the label.
  hint?: string
}

export function FormFieldLabel({ htmlFor, label, required, hint }: FormFieldLabelProps) {
  return (
    <FieldLabel htmlFor={htmlFor} className={cn("items-center gap-1", required && "text-destructive")}>
      {label}
      {required && <span aria-hidden="true">*</span>}
      {hint && <FieldHint label={label} hint={hint} />}
    </FieldLabel>
  )
}

// The "?" next to a label; shows the hint in a tooltip.
export function FieldHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <CircleHelp className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{hint}</TooltipContent>
    </Tooltip>
  )
}
