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
  discounts: "/discounts",
  discountsAdd: "/discounts/add",
  quotations: "/quotations",
  quotationsAdd: "/quotations/add",
  salesOrders: "/sales-orders",
  salesOrdersAdd: "/sales-orders/add",
  despatch: "/despatch",
  despatchAdd: "/despatch/add",
  reports: "/reports",
  users: "/users",
  usersAdd: "/users/add",
} as const

export function userRoute(id: string) {
  return `${ROUTES.users}/${id}`
}

export const GUEST_ONLY_ROUTES: readonly string[] = [
  ROUTES.login,
  ROUTES.forgotPassword,
]

export const PUBLIC_ROUTE_PREFIXES: readonly string[] = ["/auth/"]
