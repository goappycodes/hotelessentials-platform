import "server-only"

import { DOCUMENT_COMPANY_COLUMNS, getDocumentDetails } from "@/features/quotations/queries"
import type { createRequestClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createRequestClient>>

// A sales order with everything its document shows.
export async function getSalesOrderDocument(supabase: Client, salesOrderId: string) {
  const [orderResult, linesResult, companyResult] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", salesOrderId).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("*, item:items(sku)")
      .eq("sales_order_id", salesOrderId)
      .order("sort_order"),
    supabase.from("organization_settings").select(DOCUMENT_COMPANY_COLUMNS).maybeSingle(),
  ])
  if (orderResult.error || linesResult.error) throw new Error("Failed to load the sales order")
  const order = orderResult.data
  if (!order) return null

  return {
    order,
    ...(await getDocumentDetails(supabase, order.customer_id, companyResult.data, linesResult.data)),
  }
}

export type SalesOrderDocumentData = NonNullable<Awaited<ReturnType<typeof getSalesOrderDocument>>>
