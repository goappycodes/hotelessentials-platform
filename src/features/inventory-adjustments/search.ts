import "server-only"

import { inventoryAdjustmentRoute } from "@/constants/routes"
import { INVENTORY_ADJUSTMENTS_LIST } from "@/features/inventory-adjustments/list-config"
import { formatDay } from "@/lib/format"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

// Header search suggestions for Inventory Adjustments. Matches the same columns as the list.
export async function searchInventoryAdjustments(
  term: string,
  limit: number
): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, INVENTORY_ADJUSTMENTS_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("inventory_adjustments")
      .select("id, adjustment_date, reason, reference_number, status"),
    query
  )
    .order("adjustment_date", { ascending: false })
    .limit(limit)
  if (error) throw new Error("Failed to search adjustments")

  return data.map((adjustment) => ({
    id: adjustment.id,
    href: inventoryAdjustmentRoute(adjustment.id),
    title: adjustment.reason ?? "Inventory adjustment",
    details: [
      { value: formatDay(adjustment.adjustment_date) },
      ...(adjustment.reference_number
        ? [{ label: "Ref", value: adjustment.reference_number }]
        : []),
    ],
    badge:
      adjustment.status === "Adjusted"
        ? { label: "Adjusted", tone: "success" }
        : { label: "Draft" },
  }))
}
