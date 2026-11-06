"use server"

import { z } from "zod"

import { searchCustomers } from "@/features/customers/search"
import { searchDespatches } from "@/features/despatch/search"
import { searchInventory } from "@/features/inventory/search"
import { searchInventoryAdjustments } from "@/features/inventory-adjustments/search"
import { searchItems } from "@/features/items/search"
import { searchPriceLists } from "@/features/price-lists/search"
import { searchQuotations } from "@/features/quotations/search"
import { searchSalesOrders } from "@/features/sales-orders/search"
import { searchUsers } from "@/features/users/search"
import { hasAccess, type AccessScope } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import type { SearchResult, SearchScope } from "@/types/search"

const SUGGESTION_LIMIT = 5

type SearchProvider = {
  access: AccessScope
  search?: (term: string, limit: number) => Promise<SearchResult[]>
}

// Each module plugs in its search here once its table exists.
const PROVIDERS: Record<SearchScope, SearchProvider> = {
  users: { access: "admin", search: searchUsers },
  items: { access: "items", search: searchItems },
  price_lists: { access: "price_lists", search: searchPriceLists },
  inventory: { access: "inventory_adjustments", search: searchInventory },
  inventory_adjustments: { access: "inventory_adjustments", search: searchInventoryAdjustments },
  customers: { access: "customers", search: searchCustomers },
  quotations: { access: "quotations", search: searchQuotations },
  sales_orders: { access: "sales_orders", search: searchSalesOrders },
  despatch: { access: "despatch", search: searchDespatches },
}

const inputSchema = z.object({
  scope: z.enum(Object.keys(PROVIDERS) as [SearchScope, ...SearchScope[]]),
  term: z.string().trim().min(1).max(100),
})

// Suggestions for the header search, limited to the current module and what the user
// may view. Returns an empty list rather than an error for anything not allowed.
export async function searchRecords(
  scope: SearchScope,
  term: string
): Promise<SearchResult[]> {
  const parsed = inputSchema.safeParse({ scope, term })
  if (!parsed.success) return []

  const provider = PROVIDERS[parsed.data.scope]
  // The session check and the search run at the same time (one round trip instead of
  // two). The search runs as the user, so RLS limits what it can see, and its results
  // are only returned once the check passes.
  const [session, found] = await Promise.all([
    fetchSession(),
    Promise.allSettled([provider.search?.(parsed.data.term, SUGGESTION_LIMIT) ?? []]),
  ])
  if (!session?.user.isActive || !hasAccess(session, provider.access)) return []

  const [result] = found
  if (result.status === "rejected") throw result.reason
  return result.value
}
