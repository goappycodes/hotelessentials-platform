import {
  BadgePercent,
  ChartColumn,
  ClipboardList,
  Contact,
  FileText,
  Percent,
  Settings,
  House,
  Landmark,
  Package,
  ShoppingCart,
  Truck,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { ROUTES } from "@/constants/routes";
import type { AccessScope } from "@/lib/permissions";
import type { SearchScope } from "@/types/search";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  create?: { href: string; title: string };
  // Who may open it; items without one are open to every signed-in user.
  access?: AccessScope;
  // Modules with this set get the header search: suggestions from `searchRecords` for
  // `scope`, and Enter filters the list (`?q=`, so the ListConfig needs `search.columns`).
  search?: { placeholder: string; scope: SearchScope };
};

export const DASHBOARD_NAV_ITEM: NavItem = {
  title: "Dashboard",
  href: ROUTES.dashboard,
  icon: House,
  description: "Overview of Hotel Essentials's activity.",
};

export const MODULE_NAV_ITEMS = {
  items: {
    title: "Items",
    href: ROUTES.items,
    icon: Package,
    description: "Manage your product catalogue, units and pricing.",
    create: { href: ROUTES.itemsAdd, title: "New Item" },
    access: "items",
    search: {
      placeholder: "Search items by name, SKU or HSN code",
      scope: "items",
    },
  },
  priceLists: {
    title: "Price Lists",
    href: ROUTES.priceLists,
    icon: BadgePercent,
    description: "Manage item prices and customer-specific rates.",
    create: { href: ROUTES.priceListsAdd, title: "New Price List" },
    access: "price_lists",
    search: { placeholder: "Search price lists", scope: "price_lists" },
  },
  inventoryAdjustments: {
    title: "Inventory Adjustments",
    href: ROUTES.inventoryAdjustments,
    icon: Warehouse,
    description: "Add or remove stock, with a reason for every change.",
    create: { href: ROUTES.inventoryAdjustmentsAdd, title: "New Adjustment" },
    access: "inventory_adjustments",
    search: {
      placeholder: "Search adjustments by reason or reference",
      scope: "inventory_adjustments",
    },
  },
  customers: {
    title: "Customers",
    href: ROUTES.customers,
    icon: Contact,
    description: "Manage the customers you sell to.",
    create: { href: ROUTES.customersAdd, title: "New Customer" },
    access: "customers",
    search: {
      placeholder: "Search customers by name, company, email, phone or GSTIN",
      scope: "customers",
    },
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
    description: "Orders created from accepted quotations.",
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
    description:
      "Manage who can sign in, their roles and what they can access.",
    create: { href: ROUTES.usersAdd, title: "New User" },
    access: "admin",
    search: {
      placeholder: "Search users by name, email or phone",
      scope: "users",
    },
  },
  taxes: {
    title: "Taxes",
    href: ROUTES.taxes,
    icon: Percent,
    description: "Set the CGST, SGST and IGST rates that items use.",
    create: { href: ROUTES.taxesAdd, title: "New Tax" },
    access: "admin",
  },
  directTaxes: {
    title: "Direct Taxes",
    href: ROUTES.directTaxes,
    icon: Landmark,
    description:
      "TDS and TCS rates that quotations can apply under the sub total.",
    access: "admin",
  },
} satisfies Record<string, NavItem>;

export type NavGroup = {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
};

export type SidebarNavEntry = NavItem | NavGroup;

export function isNavGroup(entry: SidebarNavEntry): entry is NavGroup {
  return "items" in entry;
}

export const SIDEBAR_NAV: SidebarNavEntry[] = [
  DASHBOARD_NAV_ITEM,
  {
    title: "Items",
    icon: Package,
    items: [MODULE_NAV_ITEMS.items, MODULE_NAV_ITEMS.priceLists],
  },
  // Inventory is switched off for now; uncomment to show it in the sidebar again.
  // {
  //   title: "Inventory",
  //   icon: Warehouse,
  //   items: [MODULE_NAV_ITEMS.inventoryAdjustments],
  // },
  {
    title: "Sales",
    icon: ShoppingCart,
    items: [
      MODULE_NAV_ITEMS.customers,
      MODULE_NAV_ITEMS.quotations,
      MODULE_NAV_ITEMS.salesOrders,
      MODULE_NAV_ITEMS.despatch,
    ],
  },
  MODULE_NAV_ITEMS.reports,
  {
    title: "Settings",
    icon: Settings,
    // Users and Direct Taxes (TDS / TCS) are hidden for now. To show them again, add them
    // back here, and delete src/app/(dashboard)/users/layout.tsx for Users:
    // items: [MODULE_NAV_ITEMS.users, MODULE_NAV_ITEMS.taxes, MODULE_NAV_ITEMS.directTaxes],
    items: [MODULE_NAV_ITEMS.taxes],
  },
];

// Every page in the sidebar, flattened, with its group's title.
export const NAV_ITEMS: (NavItem & { group?: string })[] = SIDEBAR_NAV.flatMap(
  (entry) =>
    isNavGroup(entry)
      ? entry.items.map((item) => ({ ...item, group: entry.title }))
      : [entry],
);
