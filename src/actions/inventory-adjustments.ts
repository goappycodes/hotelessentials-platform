"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import type { PermissionAction } from "@/constants/permissions"
import { INVENTORY_ADJUSTMENTS_LIST } from "@/features/inventory-adjustments/list-config"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import {
  adjustmentStatusSchema,
  inventoryAdjustmentSchema,
  type InventoryAdjustmentInput,
} from "@/lib/validations/inventory-adjustment"
import type { ActionResult } from "@/types/actions"
import type { Enums } from "@/types/database"

const INVALID_INPUT = "Please check the form and try again."
const NOT_ALLOWED = "You don't have permission to do that."

async function authorize(action: PermissionAction) {
  const session = await fetchSession()
  if (!session?.user.isActive) return null
  return hasAccess(session, "inventory_adjustments", action) ? session : null
}

// The stock and item checks in the database raise messages written for users (23514);
// constraint violations ("violates check constraint …") are not.
function getAdjustmentErrorMessage(error: PostgrestError) {
  if (error.code === "23514" && !error.message.includes("violates")) return error.message
  if (error.code === "P0002") return "This adjustment no longer exists."
  return getDatabaseErrorMessage(error)
}

// Creates an adjustment (adjustmentId null) or updates one, with its item lines, in one
// database transaction (public.save_inventory_adjustment). Drafts don't change stock;
// "Adjusted" applies it, and the database refuses anything that takes stock below zero.
export async function saveInventoryAdjustment(
  adjustmentId: string | null,
  input: InventoryAdjustmentInput,
  status: Enums<"adjustment_status">
): Promise<ActionResult<{ id: string }>> {
  const id = adjustmentId === null ? null : z.uuid().safeParse(adjustmentId)
  const parsed = inventoryAdjustmentSchema.safeParse(input)
  const parsedStatus = adjustmentStatusSchema.safeParse(status)
  if (!parsed.success || !parsedStatus.success || (id && !id.success)) {
    return { success: false, error: INVALID_INPUT }
  }
  if (!(await authorize(id ? "edit" : "create"))) return { success: false, error: NOT_ALLOWED }

  const adjustment = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("save_inventory_adjustment", {
    target_id: id ? id.data : null,
    adjustment_date: adjustment.date,
    reference_number: adjustment.referenceNumber,
    account: adjustment.account,
    reason: adjustment.reason,
    description: adjustment.description,
    status: parsedStatus.data,
    items: adjustment.items
      .filter((line) => line.itemId)
      .map((line) => ({ item_id: line.itemId, quantity_adjusted: Number(line.quantityAdjusted) })),
  })

  if (error) return { success: false, error: getAdjustmentErrorMessage(error) }
  return { success: true, data: { id: data } }
}

// Deleting an adjusted adjustment reverses its stock change; refused if that would take
// any item below zero.
export async function deleteInventoryAdjustment(adjustmentId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(adjustmentId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("delete"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_adjustments")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getAdjustmentErrorMessage(error) }
  if (!data) return { success: false, error: "This adjustment no longer exists." }
  return { success: true, data: undefined }
}

const countFiltersSchema = z.record(z.string(), z.string())

// "Total Count: View" on the adjustments list. Same filters and search as the list.
export async function countInventoryAdjustments(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  if (!parsed.success || !(await authorize("view"))) throw new Error(NOT_ALLOWED)

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("inventory_adjustments").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, INVENTORY_ADJUSTMENTS_LIST)
  )
  if (error) throw new Error("Failed to count adjustments")
  return count ?? 0
}
