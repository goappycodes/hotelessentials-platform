import "server-only"

import type { SalesOrderRow } from "@/features/sales-orders/components/sales-orders-workspace"
import { SALES_ORDERS_LIST } from "@/features/sales-orders/list-config"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { createRequestClient } from "@/lib/supabase/server"
import type { Tables } from "@/types/database"

const ROW_COLUMNS = "id, order_date, so_number, quote_number, customer_name, status, total" as const

type RowRecord = Pick<
  Tables<"sales_orders">,
  "id" | "order_date" | "so_number" | "quote_number" | "customer_name" | "status" | "total"
>

function toRow(order: RowRecord): SalesOrderRow {
  return {
    id: order.id,
    orderDate: order.order_date,
    soNumber: order.so_number,
    quoteNumber: order.quote_number,
    customerName: order.customer_name,
    status: order.status,
    total: order.total,
  }
}

// One page of the sales orders list, with the URL's sort, filters and search. The order
// open beside the list comes too when it's on another page (opened from its quotation).
export async function getSalesOrderRows(params: ListSearchParams, openId: string | null) {
  const supabase = await createRequestClient()
  const query = parseListQuery(params, SALES_ORDERS_LIST)

  const { data, error } = await applyListQuery(
    supabase.from("sales_orders").select(ROW_COLUMNS),
    query
  )
  if (error) throw new Error("Failed to load sales orders")

  const page = toListPage(data, query)
  const isOnPage = page.rows.some((order) => order.id === openId)
  const openOrder =
    openId && !isOnPage
      ? (await supabase.from("sales_orders").select(ROW_COLUMNS).eq("id", openId).maybeSingle()).data
      : null

  return {
    rows: page.rows.map(toRow),
    openRow: openOrder ? toRow(openOrder) : null,
    hasNextPage: page.hasNextPage,
    isFiltered: Object.keys(query.filters).length > 0 || query.search !== null,
  }
}
