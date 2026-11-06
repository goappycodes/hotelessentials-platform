"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import type { PermissionAction } from "@/constants/permissions"
import { SALES_ORDER_STATUSES, SALES_ORDERS_LIST } from "@/features/sales-orders/list-config"
import { getSalesOrderDocument, type SalesOrderDocumentData } from "@/features/sales-orders/queries"
import { TAX_RATE_COLUMNS } from "@/features/taxes/tax-rates"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { computeQuotationTotals } from "@/lib/quotations"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import { quotationSchema, type QuotationInput } from "@/lib/validations/quotation"
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
  if (error.code === "42501") return NOT_ALLOWED
  // Messages written for users by save_sales_order ("Add at least one item." …).
  if (["23514", "23503"].includes(error.code) && !error.message.includes("violates")) {
    return error.message
  }
  return getDatabaseErrorMessage(error)
}

const num = (value: string) => Number(value || 0)
const orNull = (value: string) => value.trim() || null

const newOrderStatusSchema = z.enum(["Draft", "Confirmed"])

// Creates a sales order by hand, with its lines, in one database transaction. Uses the
// quotation form's values. Totals are worked out here from the lines, as for quotations,
// and the database assigns the SO number.
export async function createSalesOrder(
  input: QuotationInput,
  status: z.infer<typeof newOrderStatusSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = quotationSchema.safeParse(input)
  const parsedStatus = newOrderStatusSchema.safeParse(status)
  if (!parsed.success || !parsedStatus.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("create"))) return { success: false, error: NOT_ALLOWED }

  const order = parsed.data
  const supabase = await createClient()
  const { data: taxes, error: taxError } = await supabase.from("tax_rates").select(TAX_RATE_COLUMNS)
  if (taxError) return { success: false, error: getDatabaseErrorMessage(taxError) }

  const lines = order.lines.map((line) => ({
    quantity: num(line.quantity),
    rate: num(line.rate),
    discountValue: num(line.discountValue),
    discountIsPercent: line.discountIsPercent,
    taxId: line.taxId || null,
  }))
  const totals = computeQuotationTotals({
    lines,
    discountLevel: order.discountLevel,
    discountValue: num(order.discountValue),
    discountIsPercent: order.discountIsPercent,
    isDiscountBeforeTax: order.isDiscountBeforeTax,
    adjustment: num(order.adjustment),
    taxes,
  })

  const { data, error } = await supabase.rpc("save_sales_order", {
    sales_order: {
      customer_id: order.customerId,
      order_date: order.quoteDate,
      reference_number: orNull(order.referenceNumber),
      subject: orNull(order.subject),
      salesperson_id: order.salespersonId || null,
      place_of_supply: order.placeOfSupply || null,
      status: parsedStatus.data,
      discount_level: order.discountLevel,
      discount_value: order.discountLevel === "Transaction" ? num(order.discountValue) : 0,
      discount_is_percent: order.discountIsPercent,
      is_discount_before_tax: order.isDiscountBeforeTax,
      adjustment: num(order.adjustment),
      adjustment_description: orNull(order.adjustmentDescription),
      notes: orNull(order.notes),
      terms: orNull(order.terms),
      sub_total: totals.subTotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      total: totals.total,
    },
    items: order.lines.map((line, index) => ({
      item_id: line.itemId || null,
      name: line.name,
      description: orNull(line.description),
      hsn_code: orNull(line.hsnCode),
      unit: orNull(line.unit),
      quantity: lines[index].quantity,
      rate: lines[index].rate,
      // Line discounts only count at line level.
      discount_value: order.discountLevel === "Line Item" ? lines[index].discountValue : 0,
      discount_is_percent: line.discountIsPercent,
      tax_id: lines[index].taxId,
      amount: totals.lineAmounts[index],
    })),
  })
  if (error) return { success: false, error: getSalesOrderErrorMessage(error) }
  return { success: true, data: { id: data } }
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
