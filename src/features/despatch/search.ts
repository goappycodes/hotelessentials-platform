import "server-only"

import { despatchRoute } from "@/constants/routes"
import { DESPATCH_LIST } from "@/features/despatch/list-config"
import { formatDay } from "@/lib/format"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

// Header search suggestions for Despatch. Matches the same columns as the list.
export async function searchDespatches(term: string, limit: number): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, DESPATCH_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("despatches")
      .select("id, despatch_number, so_number, customer_name, despatch_date, status"),
    query
  )
    .order("despatch_number", { ascending: false })
    .limit(limit)
  if (error) throw new Error("Failed to search despatches")

  return data.map((despatch) => ({
    id: despatch.id,
    href: despatchRoute(despatch.id),
    title: `${despatch.despatch_number} · ${despatch.customer_name}`,
    details: [{ value: formatDay(despatch.despatch_date) }, { label: "Order", value: despatch.so_number }],
    badge: {
      label: despatch.status,
      tone: despatch.status === "Delivered" ? "success" : undefined,
    },
  }))
}
