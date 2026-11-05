import { QUOTATIONS_LIST } from "@/features/quotations/list-config"
import { QUOTATION_CSV_COLUMNS, toQuotationCsvRows } from "@/features/quotations/quotation-csv"
import { toCsv } from "@/lib/csv"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { createClient } from "@/lib/supabase/server"

// Quotations are read a page at a time, each with its lines.
const PAGE_SIZE = 500

// GET /quotations/export?scope=all → every quotation.
// GET /quotations/export?scope=current-view&… → the list as filtered, searched and sorted
// (all pages). One row per line item, in the style of Zoho's estimates export, so the file
// can be imported again.
export async function GET(request: Request) {
  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "quotations")) {
    return new Response("You don't have permission to export quotations.", { status: 403 })
  }

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const query = parseListQuery(params.scope === "current-view" ? params : {}, QUOTATIONS_LIST)

  const supabase = await createClient()
  const rows: (string | number)[][] = [[...QUOTATION_CSV_COLUMNS]]
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyListFilters(
      supabase.from("quotations").select("*, quotation_items(*)"),
      query
    )
      .order(query.sort, { ascending: query.order === "asc" })
      // A unique tie-breaker keeps pages from overlapping when sort values repeat.
      .order("id")
      .order("sort_order", { referencedTable: "quotation_items" })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return new Response("Failed to export quotations.", { status: 500 })

    for (const { quotation_items: lines, ...quote } of data) {
      rows.push(...toQuotationCsvRows(quote, lines))
    }
    if (data.length < PAGE_SIZE) break
  }

  const date = new Date().toISOString().slice(0, 10)
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Quotations-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
