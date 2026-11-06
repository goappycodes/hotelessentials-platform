"use server"

import { z } from "zod"

import { INVENTORY_LIST } from "@/features/inventory/list-config"
import { getItemImages, type ItemImageView } from "@/features/items/queries"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { createClient } from "@/lib/supabase/server"

const countFiltersSchema = z.record(z.string(), z.string())

// Enough to explain an item's stock; the full lists live in their own modules.
const DETAIL_LIMIT = 50

async function authorize() {
  const session = await fetchSession()
  if (!session?.user.isActive) return null
  return hasAccess(session, "inventory_adjustments") ? session : null
}

// "Total Count: View" on the inventory list. Same filters and search as the list.
export async function countInventoryItems(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  if (!parsed.success || !(await authorize())) {
    throw new Error("You don't have permission to do that.")
  }

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("inventory_list").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, INVENTORY_LIST)
  )
  if (error) throw new Error("Failed to count inventory items")
  return count ?? 0
}

export type StockDetail = {
  images: ItemImageView[]
  // Null when the user can't open sales orders.
  orders: {
    id: string
    soNumber: string
    customerName: string
    date: string
    quantity: number
  }[] | null
  history: {
    id: string
    date: string
    reason: string | null
    referenceNumber: string | null
    quantity: number
  }[]
}

// What the panel beside the stock list shows besides the row's own numbers.
export async function getStockDetail(itemId: string): Promise<StockDetail | null> {
  const id = z.uuid().safeParse(itemId)
  const session = await authorize()
  if (!id.success || !session) return null
  const canViewOrders = hasAccess(session, "sales_orders")

  const supabase = await createClient()
  const [images, orders, history] = await Promise.all([
    getItemImages(supabase, id.data),
    canViewOrders
      ? supabase
          .from("sales_orders")
          .select("id, so_number, customer_name, order_date, lines:sales_order_items!inner(quantity)")
          .eq("lines.item_id", id.data)
          .eq("status", "Confirmed")
          .order("order_date", { ascending: false })
          .order("so_number", { ascending: false })
          .limit(DETAIL_LIMIT)
      : null,
    // Drafts don't change stock.
    supabase
      .from("inventory_adjustments")
      .select(
        "id, adjustment_date, reason, reference_number, lines:inventory_adjustment_items!inner(quantity_adjusted)"
      )
      .eq("lines.item_id", id.data)
      .eq("status", "Adjusted")
      .order("adjustment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(DETAIL_LIMIT),
  ])
  if (orders?.error || history.error) throw new Error("Failed to load the stock details")

  return {
    images,
    orders:
      orders?.data.map((order) => ({
        id: order.id,
        soNumber: order.so_number,
        customerName: order.customer_name,
        date: order.order_date,
        // An order can list the same item on more than one line.
        quantity: order.lines.reduce((total, line) => total + line.quantity, 0),
      })) ?? null,
    history: history.data.map((adjustment) => ({
      id: adjustment.id,
      date: adjustment.adjustment_date,
      reason: adjustment.reason,
      referenceNumber: adjustment.reference_number,
      // One line per item in an adjustment.
      quantity: adjustment.lines[0]?.quantity_adjusted ?? 0,
    })),
  }
}
