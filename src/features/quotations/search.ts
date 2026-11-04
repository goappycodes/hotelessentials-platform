import "server-only"

import { quotationRoute } from "@/constants/routes"
import { QUOTATIONS_LIST } from "@/features/quotations/list-config"
import { formatCurrency, formatDay } from "@/lib/format"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

// Header search suggestions for Quotations. Matches the same columns as the list.
export async function searchQuotations(term: string, limit: number): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, QUOTATIONS_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("quotations")
      .select("id, quote_number, customer_name, quote_date, total, status"),
    query
  )
    .order("quote_date", { ascending: false })
    .limit(limit)
  if (error) throw new Error("Failed to search quotations")

  return data.map((quote) => ({
    id: quote.id,
    href: quotationRoute(quote.id),
    title: `${quote.quote_number} · ${quote.customer_name}`,
    details: [{ value: formatDay(quote.quote_date) }, { value: formatCurrency(quote.total) }],
    badge: { label: quote.status, tone: quote.status === "Accepted" ? "success" : undefined },
  }))
}
