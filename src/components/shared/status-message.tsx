import type { LucideIcon } from "lucide-react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

type StatusMessageProps = {
  title: string
  description: string
  code?: string
  icon?: LucideIcon
  tone?: "default" | "destructive"
  reference?: string
  children?: React.ReactNode
  className?: string
}

export function StatusMessage({
  title,
  description,
  code,
  icon: Icon,
  tone = "default",
  reference,
  children,
  className,
}: StatusMessageProps) {
  return (
    <Empty className={cn("py-16", className)}>
      <EmptyHeader>
        {code && (
          <p className="text-6xl font-semibold tracking-tight text-primary">
            {code}
          </p>
        )}
        {Icon && (
          <EmptyMedia
            variant="icon"
            className={cn(
              "size-10",
              tone === "destructive" && "bg-destructive/10 text-destructive"
            )}
          >
            <Icon className="size-5" />
          </EmptyMedia>
        )}
        <EmptyTitle className="text-lg">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
        {reference && (
          <p className="font-mono text-xs text-muted-foreground">
            Reference: {reference}
          </p>
        )}
      </EmptyHeader>
      {children && (
        <EmptyContent className="flex-row justify-center">{children}</EmptyContent>
      )}
    </Empty>
  )
}
