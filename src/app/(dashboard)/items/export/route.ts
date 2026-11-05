import { ITEMS_LIST } from "@/features/items/list-config"
import { ITEM_CSV_COLUMNS, toItemCsvRow } from "@/features/items/item-csv"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { spreadsheetResponse } from "@/lib/spreadsheet-response"
import { createClient } from "@/lib/supabase/server"

// Supabase returns at most this many rows per request, so items are read page by page.
const PAGE_SIZE = 1000

// GET /items/export?scope=all → every item, by name.
// GET /items/export?scope=current-view&sort=…&q=… → the list as filtered, searched and
// sorted (all pages). The CSV uses Zoho Books' item columns, so it can be imported again.
export async function GET(request: Request) {
  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "items")) {
    return new Response("You don't have permission to export items.", { status: 403 })
  }

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const isCurrentView = params.scope === "current-view"
  const query = parseListQuery(isCurrentView ? params : {}, ITEMS_LIST)

  const supabase = await createClient()
  const { data: taxRates, error: taxError } = await supabase
    .from("tax_rates")
    .select("id, name, rate")
  if (taxError) return new Response("Failed to export items.", { status: 500 })
  const taxes = new Map(taxRates.map((tax) => [tax.id, tax]))

  const rows: (string | number)[][] = [[...ITEM_CSV_COLUMNS]]
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyListFilters(supabase.from("item_list").select("*"), query)
      .order(query.sort, { ascending: query.order === "asc" })
      // A unique tie-breaker keeps pages from overlapping when sort values repeat.
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) return new Response("Failed to export items.", { status: 500 })

    for (const item of data) {
      rows.push(
        toItemCsvRow(item, {
          intra: item.intra_state_tax_id ? (taxes.get(item.intra_state_tax_id) ?? null) : null,
          inter: item.inter_state_tax_id ? (taxes.get(item.inter_state_tax_id) ?? null) : null,
        })
      )
    }
    if (data.length < PAGE_SIZE) break
  }

  return spreadsheetResponse(rows, "Items", params.format)
}
