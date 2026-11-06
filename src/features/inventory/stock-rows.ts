import "server-only"

import { INVENTORY_LIST } from "@/features/inventory/list-config"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { createRequestClient } from "@/lib/supabase/server"

const ROW_COLUMNS =
  "id, name, sku, unit, current_stock, reserved_stock, available_stock, ordered_quantity, incoming_stock, reorder_level, stock_status" as const

// One page of the stock list, with the URL's sort, filters and search. The item open beside
// the list comes too when it's on another page (opened from the header search).
export async function getStockRows(params: ListSearchParams, openId: string | null) {
  const supabase = await createRequestClient()
  const query = parseListQuery(params, INVENTORY_LIST)

  // Many items share the same stock, so the id keeps their order the same between pages.
  const { data, error } = await applyListQuery(
    supabase.from("inventory_list").select(ROW_COLUMNS),
    query
  ).order("id", { ascending: true })
  if (error) throw new Error("Failed to load inventory")

  const page = toListPage(data, query)
  const isOnPage = page.rows.some((item) => item.id === openId)
  const openRow =
    openId && !isOnPage
      ? (await supabase.from("inventory_list").select(ROW_COLUMNS).eq("id", openId).maybeSingle())
          .data
      : null

  return {
    rows: page.rows,
    openRow,
    hasNextPage: page.hasNextPage,
    isFiltered: Object.keys(query.filters).length > 0 || query.search !== null,
  }
}
