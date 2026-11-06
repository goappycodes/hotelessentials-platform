import "server-only"

import { DESPATCH_LIST } from "@/features/despatch/list-config"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { createRequestClient } from "@/lib/supabase/server"

const ROW_COLUMNS =
  "id, despatch_number, despatch_date, so_number, customer_name, transporter, tracking_number, status" as const

// One page of the despatch list, with the URL's sort, filters and search. The despatch open
// beside the list comes too when it's on another page (opened from its sales order).
export async function getDespatchRows(params: ListSearchParams, openId: string | null) {
  const supabase = await createRequestClient()
  const query = parseListQuery(params, DESPATCH_LIST)

  const { data, error } = await applyListQuery(
    supabase.from("despatches").select(ROW_COLUMNS),
    query
  ).order("id", { ascending: true })
  if (error) throw new Error("Failed to load despatches")

  const page = toListPage(data, query)
  const isOnPage = page.rows.some((despatch) => despatch.id === openId)
  const openRow =
    openId && !isOnPage
      ? (await supabase.from("despatches").select(ROW_COLUMNS).eq("id", openId).maybeSingle()).data
      : null

  return {
    rows: page.rows,
    openRow,
    hasNextPage: page.hasNextPage,
    isFiltered: Object.keys(query.filters).length > 0 || query.search !== null,
  }
}
