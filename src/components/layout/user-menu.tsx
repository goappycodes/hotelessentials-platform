"use client"

import { ChevronDown, LogOut } from "lucide-react"
import { useTransition } from "react"

import { signOut } from "@/actions/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { ROLE_LABELS } from "@/constants/permissions"
import type { SessionUser } from "@/lib/session"
import { getInitials } from "@/lib/utils"

export function UserMenu({ user }: { user: SessionUser }) {
  const [isSigningOut, startTransition] = useTransition()
  const displayName = user.fullName

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium md:inline">
            {displayName}
          </span>
          <ChevronDown className="hidden text-muted-foreground md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-start justify-between gap-2 font-normal">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
          <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onSelect={(event) => {
            event.preventDefault()
            startTransition(() => signOut())
          }}
        >
          {isSigningOut ? <Spinner /> : <LogOut />}
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
