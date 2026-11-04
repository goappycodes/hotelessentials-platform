import "server-only"

import type { QuotationRow } from "@/features/quotations/components/quotations-workspace"
import { isQuotationExpired } from "@/features/quotations/components/quotation-status-badge"
import { QUOTATIONS_LIST } from "@/features/quotations/list-config"
import { todayInIndia } from "@/features/quotations/quotation-input"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { createRequestClient } from "@/lib/supabase/server"

// One page of the quotations list, with the URL's sort, filters and search.
export async function getQuotationRows(params: ListSearchParams) {
  const supabase = await createRequestClient()
  const query = parseListQuery(params, QUOTATIONS_LIST)
  const today = todayInIndia()

  const { data, error } = await applyListQuery(
    supabase
      .from("quotations")
      .select("id, quote_date, quote_number, reference_number, customer_name, status, expiry_date, total"),
    query
  )
  if (error) throw new Error("Failed to load quotations")

  const page = toListPage(data, query)
  const rows: QuotationRow[] = page.rows.map((quote) => ({
    id: quote.id,
    quoteDate: quote.quote_date,
    quoteNumber: quote.quote_number,
    referenceNumber: quote.reference_number,
    customerName: quote.customer_name,
    status: quote.status,
    isExpired: isQuotationExpired(quote, today),
    total: quote.total,
  }))

  return {
    rows,
    hasNextPage: page.hasNextPage,
    isFiltered: Object.keys(query.filters).length > 0 || query.search !== null,
  }
}
