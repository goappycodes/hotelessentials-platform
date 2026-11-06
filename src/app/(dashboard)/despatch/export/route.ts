import { DESPATCH_CSV_COLUMNS, toDespatchCsvRows } from "@/features/despatch/despatch-csv"
import { DESPATCH_LIST } from "@/features/despatch/list-config"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { spreadsheetResponse } from "@/lib/spreadsheet-response"
import { createClient } from "@/lib/supabase/server"

// Despatches are read a page at a time, each with its lines.
const PAGE_SIZE = 500

// GET /despatch/export?scope=all → every despatch.
// GET /despatch/export?scope=current-view&… → the list as filtered, searched and sorted (all
// pages). One row per line item, so the file can be imported again.
export async function GET(request: Request) {
  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "despatch")) {
    return new Response("You don't have permission to export despatches.", { status: 403 })
  }

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const query = parseListQuery(params.scope === "current-view" ? params : {}, DESPATCH_LIST)

  const supabase = await createClient()
  const rows: (string | number)[][] = [[...DESPATCH_CSV_COLUMNS]]
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyListFilters(
      supabase.from("despatches").select("*, despatch_items(*, item:items(sku))"),
      query
    )
      .order(query.sort, { ascending: query.order === "asc" })
      // A unique tie-breaker keeps pages from overlapping when sort values repeat.
      .order("id")
      .order("sort_order", { referencedTable: "despatch_items" })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return new Response("Failed to export despatches.", { status: 500 })

    for (const { despatch_items: lines, ...despatch } of data) {
      rows.push(...toDespatchCsvRows(despatch, lines))
    }
    if (data.length < PAGE_SIZE) break
  }

  return spreadsheetResponse(rows, "Despatches", params.format)
}
