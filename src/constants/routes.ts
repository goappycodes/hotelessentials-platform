export const ROUTES = {
  home: "/",
  login: "/login",
  loginDeactivated: "/login?reason=deactivated",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  authConfirm: "/auth/confirm",
  authError: "/auth/error",
  authSignOutDeactivated: "/auth/sign-out?reason=deactivated",
  dashboard: "/dashboard",
  items: "/items",
  itemsAdd: "/items/add",
  // Route Handler: a CSV download (?scope=all or current-view, plus the list's filters).
  itemsExport: "/items/export",
  priceLists: "/price-lists",
  priceListsAdd: "/price-lists/add",
  inventoryAdjustments: "/inventory/adjustments",
  inventoryAdjustmentsAdd: "/inventory/adjustments/add",
  customers: "/customers",
  customersAdd: "/customers/add",
  // Route Handler: a CSV download (?scope=all or current-view, plus the list's filters).
  customersExport: "/customers/export",
  quotations: "/quotations",
  quotationsAdd: "/quotations/add",
  salesOrders: "/sales-orders",
  salesOrdersAdd: "/sales-orders/add",
  despatch: "/despatch",
  despatchAdd: "/despatch/add",
  reports: "/reports",
  users: "/users",
  usersAdd: "/users/add",
  taxes: "/settings/taxes",
  taxesAdd: "/settings/taxes/add",
} as const

export function userRoute(id: string) {
  return `${ROUTES.users}/${id}`
}

// Items open beside the list on /items itself (?item=<id>), like Zoho; editing has its own page.
export const ITEM_PARAM = "item"

export function itemRoute(id: string) {
  return `${ROUTES.items}?${ITEM_PARAM}=${id}`
}

export function itemEditRoute(id: string) {
  return `${ROUTES.items}/${id}/edit`
}

export function priceListRoute(id: string) {
  return `${ROUTES.priceLists}/${id}`
}

export function customerRoute(id: string) {
  return `${ROUTES.customers}/${id}`
}

export function inventoryAdjustmentRoute(id: string) {
  return `${ROUTES.inventoryAdjustments}/${id}`
}

// A new adjustment that starts with this item in its table (Adjust Stock on an item).
export function newAdjustmentForItemRoute(itemId: string) {
  return `${ROUTES.inventoryAdjustmentsAdd}?${ITEM_PARAM}=${itemId}`
}

export function taxRoute(id: string) {
  return `${ROUTES.taxes}/${id}`
}

export const GUEST_ONLY_ROUTES: readonly string[] = [
  ROUTES.login,
  ROUTES.forgotPassword,
]

export const PUBLIC_ROUTE_PREFIXES: readonly string[] = ["/auth/"]
