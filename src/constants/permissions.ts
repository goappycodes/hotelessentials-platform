import type { Enums } from "@/types/database"

export type UserRole = Enums<"user_role">

export const USER_ROLES = [
  "owner",
  "admin",
  "manager",
  "accountant",
  "sales",
  "staff",
] as const satisfies readonly UserRole[]

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  accountant: "Accountant",
  sales: "Sales",
  staff: "Staff",
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Full access, including managing other owners.",
  admin: "Full access and can manage users, except owners.",
  manager: "Runs day-to-day sales and operations.",
  accountant: "Looks after pricing, price lists and reports.",
  sales: "Prepares quotations and sales orders.",
  staff: "Limited access, set per module.",
}

// Owners and admins can do everything and manage users; other roles use permissions.
export const ADMIN_ROLES: readonly UserRole[] = ["owner", "admin"]

// Must match the module check on public.user_permissions.
export const APP_MODULES = [
  "items",
  "price_lists",
  "inventory_adjustments",
  "customers",
  "quotations",
  "sales_orders",
  "despatch",
  "reports",
] as const

export type AppModule = (typeof APP_MODULES)[number]

export const MODULE_LABELS: Record<AppModule, string> = {
  items: "Items",
  price_lists: "Price Lists",
  inventory_adjustments: "Inventory Adjustments",
  customers: "Customers",
  quotations: "Quotations",
  sales_orders: "Sales Orders",
  despatch: "Despatch",
  reports: "Reports",
}

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"] as const

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
}

// Actions that mean something for each module. Reports are read-only.
export const MODULE_ACTIONS: Record<AppModule, readonly PermissionAction[]> = {
  items: PERMISSION_ACTIONS,
  price_lists: PERMISSION_ACTIONS,
  inventory_adjustments: PERMISSION_ACTIONS,
  customers: PERMISSION_ACTIONS,
  quotations: PERMISSION_ACTIONS,
  sales_orders: PERMISSION_ACTIONS,
  despatch: PERMISSION_ACTIONS,
  reports: ["view"],
}

const ALL_ACTIONS = PERMISSION_ACTIONS
const VIEW_CREATE_EDIT: readonly PermissionAction[] = ["view", "create", "edit"]

// Starting permissions when a role is picked; admins can adjust them per user.
export const ROLE_DEFAULT_PERMISSIONS: Record<
  UserRole,
  Partial<Record<AppModule, readonly PermissionAction[]>>
> = {
  owner: {},
  admin: {},
  manager: {
    items: ALL_ACTIONS,
    price_lists: ALL_ACTIONS,
    inventory_adjustments: ALL_ACTIONS,
    customers: ALL_ACTIONS,
    quotations: ALL_ACTIONS,
    sales_orders: ALL_ACTIONS,
    despatch: ALL_ACTIONS,
    reports: ["view"],
  },
  accountant: {
    items: ["view"],
    price_lists: ALL_ACTIONS,
    inventory_adjustments: ["view"],
    customers: ["view"],
    quotations: ["view"],
    sales_orders: ["view"],
    despatch: ["view"],
    reports: ["view"],
  },
  sales: {
    items: ["view"],
    price_lists: ["view"],
    customers: VIEW_CREATE_EDIT,
    quotations: VIEW_CREATE_EDIT,
    sales_orders: VIEW_CREATE_EDIT,
    despatch: ["view"],
  },
  staff: {
    items: ["view"],
    inventory_adjustments: VIEW_CREATE_EDIT,
    despatch: VIEW_CREATE_EDIT,
  },
}
