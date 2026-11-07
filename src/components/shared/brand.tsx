import { cn } from "@/lib/utils"

export const APP_NAME = "hotelessentials"

// The monogram from the company logo, redrawn so it stays sharp at any size.
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="13.5 10.5 92 92"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      aria-hidden
      className={className}
    >
      <path d="M29.25 20V82M73.25 20V55M35 53H75.25M73.25 58V91H92" />
      <path d="M73.25 53A21.5 24.5 0 1 0 51.75 77.5" />
    </svg>
  )
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <BrandMark className="size-6" />
      </span>
      <span className="truncate text-base font-semibold tracking-tight">
        {APP_NAME}
      </span>
    </span>
  )
}
