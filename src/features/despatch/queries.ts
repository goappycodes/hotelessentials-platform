import "server-only"

import { DOCUMENT_COMPANY_COLUMNS, getDocumentDetails } from "@/features/quotations/queries"
import type { createRequestClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createRequestClient>>

const MAX_ORDER_OPTIONS = 500

// A despatch with everything its document shows.
export async function getDespatchDocument(supabase: Client, despatchId: string) {
  const [despatchResult, linesResult, companyResult] = await Promise.all([
    supabase.from("despatches").select("*").eq("id", despatchId).maybeSingle(),
    supabase
      .from("despatch_items")
      .select("*, item:items(sku)")
      .eq("despatch_id", despatchId)
      .order("sort_order"),
    supabase.from("organization_settings").select(DOCUMENT_COMPANY_COLUMNS).maybeSingle(),
  ])
  if (despatchResult.error || linesResult.error) throw new Error("Failed to load the despatch")
  const despatch = despatchResult.data
  if (!despatch) return null

  // Box by box, the way the goods are packed: Box 2 comes before Box 10.
  const lines = [...linesResult.data].sort((a, b) =>
    (a.box_number ?? "").localeCompare(b.box_number ?? "", "en", { numeric: true })
  )

  return {
    despatch,
    ...(await getDocumentDetails(supabase, despatch.customer_id, companyResult.data, lines)),
  }
}

export type DespatchDocumentData = NonNullable<Awaited<ReturnType<typeof getDespatchDocument>>>

// Orders that can be despatched: the Sales Order picker on a new despatch. Confirmed, with
// something left to send. Packed despatches count, because those goods are already set aside.
export async function getDespatchOrderOptions(supabase: Client) {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      "id, so_number, customer_name, order_date, lines:sales_order_items(quantity, allotted:despatch_items(quantity))"
    )
    .eq("status", "Confirmed")
    .order("so_number", { ascending: false })
    .limit(MAX_ORDER_OPTIONS)
  if (error) throw new Error("Failed to load sales orders")

  return data
    .filter((order) =>
      order.lines.some(
        (line) =>
          line.quantity > line.allotted.reduce((total, entry) => total + entry.quantity, 0)
      )
    )
    .map(({ id, so_number, customer_name, order_date }) => ({
      id,
      so_number,
      customer_name,
      order_date,
    }))
}

export type DespatchOrderOption = Awaited<ReturnType<typeof getDespatchOrderOptions>>[number]

// A confirmed order's lines with what is left to send. Packed despatches count, because
// those goods are already set aside. Stock is null for items that don't track inventory.
export async function getDespatchOrder(supabase: Client, salesOrderId: string) {
  const { data: order, error } = await supabase
    .from("sales_orders")
    .select("id, so_number, customer_name, order_date")
    .eq("id", salesOrderId)
    .eq("status", "Confirmed")
    .maybeSingle()
  if (error) throw new Error("Failed to load the sales order")
  if (!order) return null

  const { data: lines, error: linesError } = await supabase
    .from("sales_order_items")
    .select("id, item_id, name, unit, quantity, item:items(sku)")
    .eq("sales_order_id", salesOrderId)
    .order("sort_order")
  if (linesError) throw new Error("Failed to load the sales order")

  const lineIds = lines.map((line) => line.id)
  const itemIds = lines.flatMap((line) => (line.item_id ? [line.item_id] : []))
  const [allottedResult, stockResult] = await Promise.all([
    supabase
      .from("despatch_items")
      .select("sales_order_item_id, quantity")
      .in("sales_order_item_id", lineIds),
    supabase.from("item_list").select("id, stock_on_hand").in("id", itemIds),
  ])
  if (allottedResult.error || stockResult.error) throw new Error("Failed to load the sales order")

  const allotted = new Map<string, number>()
  for (const line of allottedResult.data) {
    allotted.set(
      line.sales_order_item_id,
      (allotted.get(line.sales_order_item_id) ?? 0) + line.quantity
    )
  }
  const stock = new Map(stockResult.data.map((item) => [item.id, item.stock_on_hand]))

  return {
    ...order,
    lines: lines.map((line) => {
      const taken = allotted.get(line.id) ?? 0
      return {
        id: line.id,
        name: line.name,
        sku: line.item?.sku ?? null,
        unit: line.unit,
        quantity: line.quantity,
        taken,
        remaining: Math.max(Number((line.quantity - taken).toFixed(4)), 0),
        stock: line.item_id ? (stock.get(line.item_id) ?? null) : null,
      }
    }),
  }
}

export type DespatchOrder = NonNullable<Awaited<ReturnType<typeof getDespatchOrder>>>
