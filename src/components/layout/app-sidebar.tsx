"use client"

import { ChevronRight, Plus } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { useOptimisticPathname } from "@/components/layout/navigation-progress"
import { Brand } from "@/components/shared/brand"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DASHBOARD_NAV_ITEM,
  SIDEBAR_NAV,
  isActivePath,
  isNavGroup,
  type NavGroup,
  type NavItem,
  type SidebarNavEntry,
} from "@/constants/navigation"
import { hasAccess, type UserAccess } from "@/lib/permissions"
import { cn } from "@/lib/utils"

const ACTIVE_ITEM_CLASS =
  "data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground data-[active=true]:hover:bg-sidebar-primary data-[active=true]:hover:text-sidebar-primary-foreground data-[active=true]:[&>svg]:text-sidebar-primary-foreground"

// Collapsed rail: icon stacked above a short label, with a subtle highlight for the active section.
const RAIL_ITEM_CLASS =
  "group-data-[collapsible=icon]:h-auto! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-1! group-data-[collapsible=icon]:py-2! group-data-[collapsible=icon]:[&>svg]:size-5 group-data-[collapsible=icon]:[&>span:last-child]:w-full group-data-[collapsible=icon]:[&>span:last-child]:text-center group-data-[collapsible=icon]:[&>span:last-child]:text-[0.6875rem] group-data-[collapsible=icon]:data-[active=true]:bg-sidebar-accent! group-data-[collapsible=icon]:data-[active=true]:text-sidebar-accent-foreground! group-data-[collapsible=icon]:data-[active=true]:[&>svg]:text-sidebar-accent-foreground!"

const QUICK_CREATE_ACTION_CLASS =
  "top-1.5 md:opacity-0 group-focus-within/menu-sub-item:opacity-100 group-hover/menu-sub-item:opacity-100 peer-data-[active=true]/menu-sub-button:text-sidebar-primary-foreground peer-data-[active=true]/menu-sub-button:opacity-100 peer-data-[active=true]/menu-sub-button:hover:bg-sidebar-primary-foreground/20 peer-data-[active=true]/menu-sub-button:hover:text-sidebar-primary-foreground"

// Hides what the user cannot open, and the quick-create "+" where they cannot create.
function filterNav(access: UserAccess): SidebarNavEntry[] {
  function allowItem(item: NavItem): NavItem | null {
    if (item.access && !hasAccess(access, item.access)) return null
    const canCreate = !item.access || hasAccess(access, item.access, "create")
    return canCreate ? item : { ...item, create: undefined }
  }

  return SIDEBAR_NAV.flatMap((entry): SidebarNavEntry[] => {
    if (!isNavGroup(entry)) {
      const item = allowItem(entry)
      return item ? [item] : []
    }
    const items = entry.items.flatMap((item) => allowItem(item) ?? [])
    return items.length > 0 ? [{ ...entry, items }] : []
  })
}

function SidebarBrandHeader({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <SidebarHeader className="h-14 justify-center">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            className="hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center"
          >
            <Link href={DASHBOARD_NAV_ITEM.href} onClick={onNavigate}>
              <Brand className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

function SidebarCollapseFooter() {
  return (
    <SidebarFooter className="hidden border-t border-sidebar-border md:flex">
      <SidebarTrigger className="self-end text-sidebar-foreground group-data-[collapsible=icon]:self-center" />
    </SidebarFooter>
  )
}

export function AppSidebar({ access }: { access: UserAccess }) {
  const pathname = useOptimisticPathname()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const isRail = state === "collapsed" && !isMobile
  const nav = filterNav(access)

  function closeMobileSidebar() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarBrandHeader onNavigate={closeMobileSidebar} />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {nav.map((entry) => {
                if (!isNavGroup(entry)) {
                  return (
                    <NavLinkItem
                      key={entry.href}
                      item={entry}
                      isActive={isActivePath(pathname, entry.href)}
                      onNavigate={closeMobileSidebar}
                    />
                  )
                }
                return isRail ? (
                  <RailNavGroup key={entry.title} group={entry} pathname={pathname} />
                ) : (
                  <NavGroupItem
                    key={entry.title}
                    group={entry}
                    pathname={pathname}
                    onNavigate={closeMobileSidebar}
                  />
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarCollapseFooter />
      <SidebarRail />
    </Sidebar>
  )
}

export function AppSidebarSkeleton() {
  return (
    <Sidebar collapsible="icon" aria-busy="true">
      <SidebarBrandHeader />
      <SidebarContent>
        <span className="sr-only">Loading…</span>
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {Array.from({ length: 5 }, (_, index) => (
              <SidebarMenuItem key={index}>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarCollapseFooter />
    </Sidebar>
  )
}

type NavLinkItemProps = {
  item: NavItem
  isActive: boolean
  onNavigate: () => void
}

function NavLinkItem({ item, isActive, onNavigate }: NavLinkItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn("pl-6.5", ACTIVE_ITEM_CLASS, RAIL_ITEM_CLASS)}
      >
        <Link href={item.href} onClick={onNavigate}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

type NavGroupProps = {
  group: NavGroup
  pathname: string
}

function NavGroupItem({
  group,
  pathname,
  onNavigate,
}: NavGroupProps & { onNavigate: () => void }) {
  const [isGroupOpen, setIsGroupOpen] = useState(() =>
    group.items.some((item) => isActivePath(pathname, item.href))
  )

  return (
    <Collapsible
      asChild
      open={isGroupOpen}
      onOpenChange={setIsGroupOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="-ml-1 size-3.5! text-sidebar-foreground/60 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            <group.icon />
            <span>{group.title}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 border-l-0 pr-0">
            {group.items.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={isActivePath(pathname, item.href)}
                  className={cn(
                    "peer/menu-sub-button h-8",
                    item.create && "pr-8",
                    ACTIVE_ITEM_CLASS
                  )}
                >
                  <Link href={item.href} onClick={onNavigate}>
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
                {item.create && (
                  <SidebarMenuAction asChild className={QUICK_CREATE_ACTION_CLASS}>
                    <Link
                      href={item.create.href}
                      onClick={onNavigate}
                      aria-label={item.create.title}
                      title={item.create.title}
                    >
                      <Plus />
                    </Link>
                  </SidebarMenuAction>
                )}
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

const FLYOUT_CLOSE_DELAY_MS = 150

// The whole flyout row carries the highlight, using the same colours as the sidebar.
const FLYOUT_ITEM_CLASS =
  "text-inherit focus:bg-transparent focus:text-inherit not-data-[variant=destructive]:focus:**:text-inherit"

function RailNavGroup({ group, pathname }: NavGroupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const openedByHover = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const hasActiveChild = group.items.some((item) =>
    isActivePath(pathname, item.href)
  )

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  function handlePointerEnter(event: React.PointerEvent) {
    if (event.pointerType !== "mouse") return
    clearTimeout(closeTimer.current)
    openedByHover.current = true
    setIsOpen(true)
  }

  function handlePointerLeave(event: React.PointerEvent) {
    if (event.pointerType !== "mouse") return
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setIsOpen(false), FLYOUT_CLOSE_DELAY_MS)
  }

  function handleOpenChange(open: boolean) {
    if (open) openedByHover.current = false
    setIsOpen(open)
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
        <DropdownMenuTrigger
          asChild
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onPointerDown={(event) => {
            // Clicking the group always opens the flyout; it never toggles an open one closed.
            if (isOpen) event.preventDefault()
          }}
        >
          <SidebarMenuButton
            ref={triggerRef}
            isActive={hasActiveChild}
            className={RAIL_ITEM_CLASS}
          >
            <group.icon />
            <span>{group.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-56"
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onInteractOutside={(event) => {
            if (
              event.target instanceof Node &&
              triggerRef.current?.contains(event.target)
            ) {
              event.preventDefault()
            }
          }}
          onCloseAutoFocus={(event) => {
            if (openedByHover.current) event.preventDefault()
          }}
        >
          <DropdownMenuLabel className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.title}
          </DropdownMenuLabel>
          {group.items.map((item) => {
            const isActive = isActivePath(pathname, item.href)

            return (
              <div
                key={item.href}
                className={cn(
                  "group/flyout-item flex items-center gap-1 rounded-md text-sidebar-foreground",
                  isActive
                    ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground has-focus:bg-sidebar-accent has-focus:text-sidebar-accent-foreground"
                )}
              >
                <DropdownMenuItem
                  asChild
                  className={cn("flex-1", FLYOUT_ITEM_CLASS)}
                >
                  <Link href={item.href}>{item.title}</Link>
                </DropdownMenuItem>
                {item.create && (
                  <DropdownMenuItem
                    asChild
                    className={cn(
                      "size-7 justify-center p-0 opacity-0 group-hover/flyout-item:opacity-100 focus:opacity-100",
                      FLYOUT_ITEM_CLASS,
                      isActive && "opacity-100"
                    )}
                  >
                    <Link
                      href={item.create.href}
                      aria-label={item.create.title}
                      title={item.create.title}
                    >
                      <Plus className="text-current" />
                    </Link>
                  </DropdownMenuItem>
                )}
              </div>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
