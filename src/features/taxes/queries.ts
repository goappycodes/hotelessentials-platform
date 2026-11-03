import "server-only"

import { TAX_RATE_COLUMNS } from "@/features/taxes/tax-rates"
import type { createRequestClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createRequestClient>>

// Intra-state taxes first, each scope ordered by rate.
export async function getTaxRates(supabase: Client) {
  const { data, error } = await supabase
    .from("tax_rates")
    .select(TAX_RATE_COLUMNS)
    .order("tax_scope")
    .order("rate")
    .order("name")
  if (error) throw new Error("Failed to load tax rates")
  return data
}
