import { ConciergeBell } from "lucide-react"
import { cn } from "@/lib/utils"

export const APP_NAME = "hotelessentials"

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <ConciergeBell className="size-4" aria-hidden />
      </span>
      <span className="truncate text-base font-semibold tracking-tight">
        {APP_NAME}
      </span>
    </span>
  )
}
