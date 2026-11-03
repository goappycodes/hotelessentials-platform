import {
  BadgePercent,
  ChartColumn,
  ClipboardList,
  FileText,
  House,
  Package,
  ShoppingCart,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { ROUTES } from "@/constants/routes"
import type { AccessScope } from "@/lib/permissions"
import type { SearchScope } from "@/types/search"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description: string
  create?: { href: string; title: string }
  // Who may open it; items without one are open to every signed-in user.
  access?: AccessScope
  // Modules with this set get the header search: suggestions from `searchRecords` for
  // `scope`, and Enter filters the list (`?q=`, so the ListConfig needs `search.columns`).
  search?: { placeholder: string; scope: SearchScope }
}

export const DASHBOARD_NAV_ITEM: NavItem = {
  title: "Dashboard",
  href: ROUTES.dashboard,
  icon: House,
  description: "Overview of your company's activity.",
}

export const MODULE_NAV_ITEMS = {
  items: {
    title: "Items",
    href: ROUTES.items,
    icon: Package,
    description: "Manage your product catalogue, units and pricing.",
    create: { href: ROUTES.itemsAdd, title: "New Item" },
    access: "items",
    search: { placeholder: "Search items", scope: "items" },
  },
  discounts: {
    title: "Price List",
    href: ROUTES.discounts,
    icon: BadgePercent,
    description: "Configure item and customer discount rules.",
    create: { href: ROUTES.discountsAdd, title: "New Discount" },
    access: "discounts",
    search: { placeholder: "Search discounts", scope: "discounts" },
  },
  quotations: {
    title: "Quotations",
    href: ROUTES.quotations,
    icon: FileText,
    description: "Prepare and send quotations to customers.",
    create: { href: ROUTES.quotationsAdd, title: "New Quotation" },
    access: "quotations",
    search: { placeholder: "Search quotations", scope: "quotations" },
  },
  salesOrders: {
    title: "Sales Orders",
    href: ROUTES.salesOrders,
    icon: ClipboardList,
    description: "Convert quotations into confirmed sales orders.",
    create: { href: ROUTES.salesOrdersAdd, title: "New Sales Order" },
    access: "sales_orders",
    search: { placeholder: "Search sales orders", scope: "sales_orders" },
  },
  despatch: {
    title: "Despatch",
    href: ROUTES.despatch,
    icon: Truck,
    description: "Plan and track despatch of sales orders.",
    create: { href: ROUTES.despatchAdd, title: "New Despatch" },
    access: "despatch",
    search: { placeholder: "Search despatches", scope: "despatch" },
  },
  reports: {
    title: "Reports",
    href: ROUTES.reports,
    icon: ChartColumn,
    description: "Analyse items, quotations, orders and despatch.",
    access: "reports",
  },
  users: {
    title: "Users",
    href: ROUTES.users,
    icon: UsersRound,
    description: "Manage who can sign in, their roles and what they can access.",
    create: { href: ROUTES.usersAdd, title: "New User" },
    access: "admin",
    search: { placeholder: "Search users by name, email or phone", scope: "users" },
  },
} satisfies Record<string, NavItem>

export type NavGroup = {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

export type SidebarNavEntry = NavItem | NavGroup

export function isNavGroup(entry: SidebarNavEntry): entry is NavGroup {
  return "items" in entry
}

export const SIDEBAR_NAV: SidebarNavEntry[] = [
  DASHBOARD_NAV_ITEM,
  {
    title: "Items",
    icon: Package,
    items: [MODULE_NAV_ITEMS.items, MODULE_NAV_ITEMS.discounts],
  },
  {
    title: "Sales",
    icon: ShoppingCart,
    items: [
      MODULE_NAV_ITEMS.quotations,
      MODULE_NAV_ITEMS.salesOrders,
      MODULE_NAV_ITEMS.despatch,
    ],
  },
  MODULE_NAV_ITEMS.reports,
  MODULE_NAV_ITEMS.users,
]

// Every page in the sidebar, flattened, with its group's title.
export const NAV_ITEMS: (NavItem & { group?: string })[] = SIDEBAR_NAV.flatMap((entry) =>
  isNavGroup(entry)
    ? entry.items.map((item) => ({ ...item, group: entry.title }))
    : [entry]
)
