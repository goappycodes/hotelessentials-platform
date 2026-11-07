import "server-only"

import {
  ROUTES,
  despatchRoute,
  inventoryItemRoute,
  quotationRoute,
  salesOrderRoute,
} from "@/constants/routes"
import { isQuotationExpired } from "@/features/quotations/components/quotation-status-badge"
import { todayInIndia } from "@/features/quotations/quotation-input"
import { formatDay } from "@/lib/format"
import { toSearchString } from "@/lib/list-query"
import { hasAccess, type UserAccess } from "@/lib/permissions"
import { createRequestClient } from "@/lib/supabase/server"

const LIST_LENGTH = 5

// Sales Overview is hidden for now; uncomment with the parts marked below.
// const SALES_MONTHS = 6
// const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" })
// const monthYearFormat = new Intl.DateTimeFormat("en-GB", {
//   month: "long",
//   year: "numeric",
//   timeZone: "UTC",
// })

// Everything on the Dashboard, limited to the modules this person can open. Row level
// security enforces the same limits; this only leaves out what they'd see as empty.
export async function getDashboardData(access: UserAccess) {
  const supabase = await createRequestClient()
  const can = {
    quotations: hasAccess(access, "quotations"),
    orders: hasAccess(access, "sales_orders"),
    despatch: hasAccess(access, "despatch"),
    stock: hasAccess(access, "inventory_adjustments"),
  }
  const today = todayInIndia()

  const [
    openQuotes,
    ordersToSend,
    packedDespatches,
    stockAlertCount,
    // monthly, // Sales Overview
    stockAlerts,
    recentQuotes,
    recentOrders,
    recentDespatches,
  ] = await Promise.all([
    can.quotations
      ? supabase
          .from("quotations")
          .select("id", { count: "exact", head: true })
          .eq("status", "Sent")
          .or(`expiry_date.is.null,expiry_date.gte.${today}`)
      : null,
    can.orders
      ? supabase
          .from("sales_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "Confirmed")
      : null,
    can.despatch
      ? supabase
          .from("despatches")
          .select("id", { count: "exact", head: true })
          .eq("status", "Packed")
      : null,
    can.stock
      ? supabase
          .from("inventory_list")
          .select("id", { count: "exact", head: true })
          .neq("stock_status", "In Stock")
      : null,
    // Sales Overview:
    // can.quotations || can.orders
    //   ? supabase.rpc("dashboard_monthly_sales", { months: SALES_MONTHS })
    //   : null,
    can.stock
      ? supabase
          .from("inventory_list")
          .select("id, name, sku, unit, available_stock, ordered_quantity, stock_status")
          .neq("stock_status", "In Stock")
          // What confirmed orders are waiting on comes first.
          .order("ordered_quantity", { ascending: false })
          .order("available_stock", { ascending: true })
          .order("id")
          .limit(LIST_LENGTH)
      : null,
    can.quotations
      ? supabase
          .from("quotations")
          .select("id, quote_number, customer_name, quote_date, status, expiry_date, created_at")
          .order("created_at", { ascending: false })
          .limit(LIST_LENGTH)
      : null,
    can.orders
      ? supabase
          .from("sales_orders")
          .select("id, so_number, customer_name, order_date, status, created_at")
          .order("created_at", { ascending: false })
          .limit(LIST_LENGTH)
      : null,
    can.despatch
      ? supabase
          .from("despatches")
          .select("id, despatch_number, customer_name, despatch_date, status, created_at")
          .order("created_at", { ascending: false })
          .limit(LIST_LENGTH)
      : null,
  ])

  for (const result of [
    openQuotes,
    ordersToSend,
    packedDespatches,
    stockAlertCount,
    // monthly, // Sales Overview
    stockAlerts,
    recentQuotes,
    recentOrders,
    recentDespatches,
  ]) {
    if (result?.error) throw new Error("Failed to load the dashboard")
  }

  const tiles = [
    ...(openQuotes
      ? [
          {
            title: "Open Quotations",
            description: "Sent, waiting for the customer",
            value: openQuotes.count ?? 0,
            href: `${ROUTES.quotations}${toSearchString({ status: "Sent" })}`,
          },
        ]
      : []),
    ...(ordersToSend
      ? [
          {
            title: "Orders to Send",
            description: "Confirmed sales orders",
            value: ordersToSend.count ?? 0,
            href: `${ROUTES.salesOrders}${toSearchString({ status: "Confirmed" })}`,
          },
        ]
      : []),
    ...(packedDespatches
      ? [
          {
            title: "Packed Despatches",
            description: "Ready to leave",
            value: packedDespatches.count ?? 0,
            href: `${ROUTES.despatch}${toSearchString({ status: "Packed" })}`,
          },
        ]
      : []),
    ...(stockAlertCount
      ? [
          {
            title: "Stock Alerts",
            description: "Low or out of stock",
            value: stockAlertCount.count ?? 0,
            href: `${ROUTES.inventory}${toSearchString({ sort: "available_stock", order: "asc" })}`,
          },
        ]
      : []),
  ]

  const recent = [
    ...(recentQuotes?.data ?? []).map((quote) => ({
      id: quote.id,
      kind: "Quotation" as const,
      number: quote.quote_number,
      customer: quote.customer_name,
      date: formatDay(quote.quote_date),
      createdAt: quote.created_at,
      href: quotationRoute(quote.id),
      quote: { status: quote.status, isExpired: isQuotationExpired(quote, today) },
    })),
    ...(recentOrders?.data ?? []).map((order) => ({
      id: order.id,
      kind: "Sales Order" as const,
      number: order.so_number,
      customer: order.customer_name,
      date: formatDay(order.order_date),
      createdAt: order.created_at,
      href: salesOrderRoute(order.id),
      orderStatus: order.status,
    })),
    ...(recentDespatches?.data ?? []).map((despatch) => ({
      id: despatch.id,
      kind: "Despatch" as const,
      number: despatch.despatch_number,
      customer: despatch.customer_name,
      date: formatDay(despatch.despatch_date),
      createdAt: despatch.created_at,
      href: despatchRoute(despatch.id),
      despatchStatus: despatch.status,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LIST_LENGTH)

  return {
    can,
    tiles,
    // Sales Overview:
    // sales: (monthly?.data ?? []).map((row) => {
    //   const date = new Date(`${row.month}T00:00:00Z`)
    //   return {
    //     label: monthFormat.format(date),
    //     fullLabel: monthYearFormat.format(date),
    //     quotations: row.quotation_total,
    //     quotationCount: row.quotation_count,
    //     orders: row.order_total,
    //     orderCount: row.order_count,
    //   }
    // }),
    stockAlerts: (stockAlerts?.data ?? []).map((item) => ({
      ...item,
      href: inventoryItemRoute(item.id),
    })),
    recent,
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

// One month of Sales Overview, hidden for now (see features/dashboard/components/sales-chart).
export type DashboardSalesMonth = {
  label: string
  fullLabel: string
  quotations: number
  quotationCount: number
  orders: number
  orderCount: number
}
