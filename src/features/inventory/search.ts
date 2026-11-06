import "server-only"

import { inventoryItemRoute } from "@/constants/routes"
import { INVENTORY_LIST } from "@/features/inventory/list-config"
import { formatQuantity } from "@/lib/format"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

const BADGE_TONES = {
  "In Stock": "success",
  "Low Stock": "default",
  "Out of Stock": "destructive",
} as const

// Header search suggestions for Inventory. Matches the same columns as the list.
export async function searchInventory(term: string, limit: number): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, INVENTORY_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("inventory_list")
      .select("id, name, sku, unit, available_stock, stock_status"),
    query
  )
    .order("name", { ascending: true })
    .limit(limit)
  if (error) throw new Error("Failed to search inventory")

  return data.map((item) => ({
    id: item.id,
    href: inventoryItemRoute(item.id),
    title: item.name,
    details: [
      ...(item.sku ? [{ label: "SKU", value: item.sku }] : []),
      { label: "Available", value: formatQuantity(item.available_stock, item.unit) },
    ],
    badge: { label: item.stock_status, tone: BADGE_TONES[item.stock_status] },
  }))
}
