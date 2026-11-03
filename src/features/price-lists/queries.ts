import "server-only"

import type { createRequestClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createRequestClient>>

const MAX_ITEM_OPTIONS = 1000

// Items that can be given a custom rate in an "Individual Items" price list.
export async function getPriceListItemOptions(supabase: Client) {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, sku, unit, selling_price, cost_price, sales_enabled, purchase_enabled, is_active")
    .order("name")
    .limit(MAX_ITEM_OPTIONS)
  if (error) throw new Error("Failed to load items")
  return data
}

export type PriceListItemOption = Awaited<ReturnType<typeof getPriceListItemOptions>>[number]
