"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import type { PermissionAction } from "@/constants/permissions"
import { SALES_ORDER_STATUSES, SALES_ORDERS_LIST } from "@/features/sales-orders/list-config"
import { getSalesOrderDocument, type SalesOrderDocumentData } from "@/features/sales-orders/queries"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/types/actions"
import type { Enums } from "@/types/database"

const INVALID_INPUT = "Please check the form and try again."
const NOT_ALLOWED = "You don't have permission to do that."
const NOT_FOUND = "This sales order no longer exists."

const statusSchema = z.enum(SALES_ORDER_STATUSES)
const countFiltersSchema = z.record(z.string(), z.string())

async function authorize(action: PermissionAction) {
  const session = await fetchSession()
  if (!session?.user.isActive) return null
  return hasAccess(session, "sales_orders", action) ? session : null
}

function getSalesOrderErrorMessage(error: PostgrestError) {
  if (error.code === "P0002") return NOT_FOUND
  return getDatabaseErrorMessage(error)
}

export async function getSalesOrderDetail(
  salesOrderId: string
): Promise<SalesOrderDocumentData | null> {
  const id = z.uuid().safeParse(salesOrderId)
  if (!id.success || !(await authorize("view"))) return null
  return getSalesOrderDocument(await createClient(), id.data)
}

export async function setSalesOrderStatus(
  salesOrderId: string,
  status: Enums<"sales_order_status">
): Promise<ActionResult> {
  const id = z.uuid().safeParse(salesOrderId)
  const parsedStatus = statusSchema.safeParse(status)
  if (!id.success || !parsedStatus.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sales_orders")
    .update({ status: parsedStatus.data })
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getSalesOrderErrorMessage(error) }
  if (!data) return { success: false, error: NOT_FOUND }
  return { success: true, data: undefined }
}

// Its quotation stays. Accepting that quotation again would create a new order.
export async function deleteSalesOrder(salesOrderId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(salesOrderId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("delete"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sales_orders")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getSalesOrderErrorMessage(error) }
  if (!data) return { success: false, error: NOT_FOUND }
  return { success: true, data: undefined }
}

// The total for the list's "of N", counted only when asked for.
export async function countSalesOrders(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  if (!parsed.success || !(await authorize("view"))) throw new Error(NOT_ALLOWED)

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("sales_orders").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, SALES_ORDERS_LIST)
  )
  if (error) throw new Error("Failed to count sales orders")
  return count ?? 0
}
