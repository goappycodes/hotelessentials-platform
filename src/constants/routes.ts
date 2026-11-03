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
  priceLists: "/price-lists",
  priceListsAdd: "/price-lists/add",
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

export function taxRoute(id: string) {
  return `${ROUTES.taxes}/${id}`
}

export const GUEST_ONLY_ROUTES: readonly string[] = [
  ROUTES.login,
  ROUTES.forgotPassword,
]

export const PUBLIC_ROUTE_PREFIXES: readonly string[] = ["/auth/"]
