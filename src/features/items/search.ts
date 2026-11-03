import "server-only"

import { itemRoute } from "@/constants/routes"
import { ITEMS_LIST } from "@/features/items/list-config"
import { formatCurrency } from "@/lib/format"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

// Header search suggestions for the Items module. Matches the same columns as the list.
export async function searchItems(term: string, limit: number): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, ITEMS_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("item_list")
      .select(
        "id, name, sku, type, hsn_code, selling_price, cost_price, sales_enabled, purchase_enabled, is_active"
      ),
    query
  )
    .order("name")
    .limit(limit)
  if (error) throw new Error("Failed to search items")

  return data.map((item) => ({
    id: item.id,
    href: itemRoute(item.id),
    title: item.name,
    details: [
      ...(item.sku ? [{ label: "SKU", value: item.sku }] : []),
      ...(item.hsn_code ? [{ label: "HSN", value: item.hsn_code }] : []),
      ...(item.sales_enabled ? [{ label: "Rate", value: formatCurrency(item.selling_price) }] : []),
      ...(item.purchase_enabled
        ? [{ label: "Purchase Rate", value: formatCurrency(item.cost_price) }]
        : []),
    ],
    badge: item.is_active
      ? { label: item.type }
      : { label: "Inactive", tone: "destructive" },
  }))
}
