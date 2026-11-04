import { CUSTOMER_CSV_COLUMNS, toCustomerCsvRow } from "@/features/customers/customer-csv"
import { CUSTOMERS_LIST } from "@/features/customers/list-config"
import { toCsv } from "@/lib/csv"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { createClient } from "@/lib/supabase/server"

// Supabase returns at most this many rows per request, so customers are read page by page.
const PAGE_SIZE = 1000

// GET /customers/export?scope=all → every customer, by name.
// GET /customers/export?scope=current-view&… → the list as filtered, searched and sorted
// (all pages). The CSV uses Zoho Books' contacts columns, so it can be imported again.
export async function GET(request: Request) {
  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "customers")) {
    return new Response("You don't have permission to export customers.", { status: 403 })
  }

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const query = parseListQuery(params.scope === "current-view" ? params : {}, CUSTOMERS_LIST)

  const supabase = await createClient()
  const { data: priceLists } = await supabase.from("price_lists").select("id, name")
  const priceListNames = new Map((priceLists ?? []).map((list) => [list.id, list.name]))

  const rows: (string | number)[][] = [[...CUSTOMER_CSV_COLUMNS]]
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyListFilters(supabase.from("customers").select("*"), query)
      .order(query.sort, { ascending: query.order === "asc" })
      // A unique tie-breaker keeps pages from overlapping when sort values repeat.
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) return new Response("Failed to export customers.", { status: 500 })

    for (const customer of data) {
      rows.push(
        toCustomerCsvRow(
          customer,
          customer.price_list_id ? (priceListNames.get(customer.price_list_id) ?? null) : null
        )
      )
    }
    if (data.length < PAGE_SIZE) break
  }

  const date = new Date().toISOString().slice(0, 10)
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Customers-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
