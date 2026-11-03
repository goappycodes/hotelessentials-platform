import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { ROLE_LABELS } from "@/constants/permissions"
import { requireUser } from "@/lib/session"
import { getInitials } from "@/lib/utils"

export async function DashboardGreeting() {
  const { user } = await requireUser()

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-12 rounded-lg border">
        <AvatarFallback className="rounded-lg bg-accent font-semibold text-accent-foreground">
          {getInitials(user.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">
          Hello, {user.firstName}
        </h1>
        <p className="truncate text-sm tracking-wide text-muted-foreground uppercase">
          {ROLE_LABELS[user.role]}
        </p>
      </div>
    </div>
  )
}

export function DashboardGreetingSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-12 rounded-lg" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}
