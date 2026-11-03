import "server-only"

import { priceListRoute } from "@/constants/routes"
import { PRICE_LISTS_LIST } from "@/features/price-lists/list-config"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { describeAdjustment } from "@/lib/price-lists"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

// Header search suggestions for Price Lists. Matches the same columns as the list.
export async function searchPriceLists(term: string, limit: number): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, PRICE_LISTS_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("price_lists")
      .select("id, name, transaction_type, price_list_type, percentage_type, percentage_value, is_active"),
    query
  )
    .order("name")
    .limit(limit)
  if (error) throw new Error("Failed to search price lists")

  return data.map((list) => ({
    id: list.id,
    href: priceListRoute(list.id),
    title: list.name,
    details: [
      { value: list.transaction_type },
      {
        value:
          describeAdjustment(list.percentage_type, list.percentage_value) ?? list.price_list_type,
      },
    ],
    badge: list.is_active
      ? { label: "Active", tone: "success" }
      : { label: "Inactive", tone: "destructive" },
  }))
}
