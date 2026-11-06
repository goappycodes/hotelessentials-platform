import "server-only"

import { salesOrderRoute } from "@/constants/routes"
import { SALES_ORDERS_LIST } from "@/features/sales-orders/list-config"
import { formatCurrency, formatDay } from "@/lib/format"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

// Header search suggestions for Sales Orders. Matches the same columns as the list.
export async function searchSalesOrders(term: string, limit: number): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, SALES_ORDERS_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("sales_orders")
      .select("id, so_number, customer_name, order_date, total, status"),
    query
  )
    .order("so_number", { ascending: false })
    .limit(limit)
  if (error) throw new Error("Failed to search sales orders")

  return data.map((order) => ({
    id: order.id,
    href: salesOrderRoute(order.id),
    title: `${order.so_number} · ${order.customer_name}`,
    details: [{ value: formatDay(order.order_date) }, { value: formatCurrency(order.total) }],
    badge: { label: order.status, tone: order.status === "Closed" ? "success" : undefined },
  }))
}
