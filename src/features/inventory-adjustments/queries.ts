import "server-only"

import type { createRequestClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createRequestClient>>

const MAX_ITEM_OPTIONS = 1000

// Items an adjustment can include: goods that track inventory, with their stock on hand.
// Inactive ones are listed too, so an existing adjustment can still show them; the form
// only offers active ones for new rows.
export async function getAdjustmentItemOptions(supabase: Client) {
  const { data, error } = await supabase
    .from("item_list")
    .select("id, name, sku, unit, is_active, stock_on_hand")
    .eq("track_inventory", true)
    .order("name")
    .limit(MAX_ITEM_OPTIONS)
  if (error) throw new Error("Failed to load items")
  return data.map((item) => ({ ...item, stock_on_hand: item.stock_on_hand ?? 0 }))
}

export type AdjustmentItemOption = Awaited<ReturnType<typeof getAdjustmentItemOptions>>[number]
