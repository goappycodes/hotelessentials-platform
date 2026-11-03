import { Bell } from "lucide-react"
import { Suspense } from "react"

import { HeaderSearch } from "@/components/layout/header-search"
import { UserMenu } from "@/components/layout/user-menu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { requireUser } from "@/lib/session"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4 md:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-5 md:hidden"
      />
      {/* Reads the URL, which needs <Suspense>; renders nothing outside a module. */}
      <Suspense>
        <HeaderSearch />
      </Suspense>
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
        <Suspense fallback={<Skeleton className="size-9 rounded-full md:w-36" />}>
          <SessionUserMenu />
        </Suspense>
      </div>
    </header>
  )
}

async function SessionUserMenu() {
  const { user } = await requireUser()
  return <UserMenu user={user} />
}
