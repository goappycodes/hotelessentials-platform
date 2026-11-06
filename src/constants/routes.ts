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
  quotationsExport: "/quotations/export",
  salesOrders: "/sales-orders",
  despatch: "/despatch",
  despatchAdd: "/despatch/add",
  reports: "/reports",
  users: "/users",
  usersAdd: "/users/add",
  taxes: "/settings/taxes",
  taxesAdd: "/settings/taxes/add",
  directTaxes: "/settings/direct-taxes",
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

// Quotations open beside the list on /quotations (?quote=<id>), like items.
export const QUOTATION_PARAM = "quote"

export function quotationRoute(id: string) {
  return `${ROUTES.quotations}?${QUOTATION_PARAM}=${id}`
}

export function quotationEditRoute(id: string) {
  return `${ROUTES.quotations}/${id}/edit`
}

// The quote on its own, for printing or saving as PDF.
export function quotationPrintRoute(id: string) {
  return `/print/quotations/${id}`
}

// Sales orders open beside the list on /sales-orders (?order=<id>), like quotations.
export const SALES_ORDER_PARAM = "order"

export function salesOrderRoute(id: string) {
  return `${ROUTES.salesOrders}?${SALES_ORDER_PARAM}=${id}`
}

// A sales order on its own page, for printing or saving as PDF.
export function salesOrderPrintRoute(id: string) {
  return `/print/sales-orders/${id}`
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
