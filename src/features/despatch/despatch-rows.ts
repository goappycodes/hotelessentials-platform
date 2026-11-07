import "server-only"

import type { DespatchRow } from "@/features/despatch/components/despatch-workspace"
import { DESPATCH_LIST } from "@/features/despatch/list-config"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { createRequestClient } from "@/lib/supabase/server"

const ROW_COLUMNS =
  "id, despatch_number, despatch_date, so_number, customer_name, transporter, tracking_number, status, lines:despatch_items(box_number, quantity), order:sales_orders(lines:sales_order_items(quantity, allotted:despatch_items(quantity)))" as const

const sum = <T,>(values: T[], amount: (value: T) => number) =>
  Number(values.reduce((total, value) => total + amount(value), 0).toFixed(4))

type RowRecord = Omit<DespatchRow, "boxes" | "sentItems" | "remainingItems" | "totalItems"> & {
  lines: { box_number: string | null; quantity: number }[]
  order: { lines: { quantity: number; allotted: { quantity: number }[] }[] }
}

// Sent is what's on this despatch. Remaining and Total are for its whole order, so they read
// the same on every despatch of that order, and match what New Despatch shows as left.
function toRow({ lines, order, ...despatch }: RowRecord): DespatchRow {
  const boxes = new Set(lines.flatMap((line) => (line.box_number ? [line.box_number] : [])))
  return {
    ...despatch,
    boxes: [...boxes].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
    sentItems: sum(lines, (line) => line.quantity),
    remainingItems: sum(order.lines, (line) =>
      Math.max(line.quantity - sum(line.allotted, (entry) => entry.quantity), 0)
    ),
    totalItems: sum(order.lines, (line) => line.quantity),
  }
}

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
    rows: page.rows.map(toRow),
    openRow: openRow ? toRow(openRow) : null,
    hasNextPage: page.hasNextPage,
    isFiltered: Object.keys(query.filters).length > 0 || query.search !== null,
  }
}
