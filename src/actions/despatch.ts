"use server"

import { z } from "zod"

import type { PermissionAction } from "@/constants/permissions"
import { getDespatchErrorMessage } from "@/features/despatch/despatch-errors"
import { DESPATCH_LIST, DESPATCH_STATUSES } from "@/features/despatch/list-config"
import { getDespatchDocument, type DespatchDocumentData } from "@/features/despatch/queries"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { createClient } from "@/lib/supabase/server"
import {
  despatchDetailsSchema,
  despatchSchema,
  type DespatchDetailsInput,
  type DespatchInput,
} from "@/lib/validations/despatch"
import type { ActionResult } from "@/types/actions"
import type { Enums } from "@/types/database"

const INVALID_INPUT = "Please check the form and try again."
const NOT_ALLOWED = "You don't have permission to do that."
const NOT_FOUND = "This despatch no longer exists."

const statusSchema = z.enum(DESPATCH_STATUSES)
const newStatusSchema = z.enum(["Packed", "Despatched"])
const countFiltersSchema = z.record(z.string(), z.string())

async function authorize(action: PermissionAction) {
  const session = await fetchSession()
  if (!session?.user.isActive) return null
  return hasAccess(session, "despatch", action) ? session : null
}

// Creates a despatch and its lines in one database transaction, which assigns the number.
export async function saveDespatch(
  input: DespatchInput,
  status: z.infer<typeof newStatusSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = despatchSchema.safeParse(input)
  const parsedStatus = newStatusSchema.safeParse(status)
  if (!parsed.success || !parsedStatus.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("create"))) return { success: false, error: NOT_ALLOWED }

  const despatch = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("save_despatch", {
    despatch: {
      sales_order_id: despatch.salesOrderId,
      despatch_date: despatch.date,
      status: parsedStatus.data,
      transporter: despatch.transporter,
      tracking_number: despatch.trackingNumber,
      vehicle_number: despatch.vehicleNumber,
      notes: despatch.notes,
    },
    items: despatch.lines
      .filter((line) => Number(line.quantity) > 0)
      .map((line) => ({
        sales_order_item_id: line.salesOrderItemId,
        box_number: line.boxNumber,
        quantity: Number(line.quantity),
      })),
  })

  if (error) return { success: false, error: getDespatchErrorMessage(error) }
  return { success: true, data: { id: data } }
}

export async function getDespatchDetail(despatchId: string): Promise<DespatchDocumentData | null> {
  const id = z.uuid().safeParse(despatchId)
  if (!id.success || !(await authorize("view"))) return null
  return getDespatchDocument(await createClient(), id.data)
}

export async function setDespatchStatus(
  despatchId: string,
  status: Enums<"despatch_status">
): Promise<ActionResult> {
  const id = z.uuid().safeParse(despatchId)
  const parsedStatus = statusSchema.safeParse(status)
  if (!id.success || !parsedStatus.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("despatches")
    .update({ status: parsedStatus.data })
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getDespatchErrorMessage(error) }
  if (!data) return { success: false, error: NOT_FOUND }
  return { success: true, data: undefined }
}

// The date, transporter and tracking details. Items and quantities don't change: delete a
// packed despatch and pack it again instead.
export async function updateDespatchDetails(
  despatchId: string,
  input: DespatchDetailsInput
): Promise<ActionResult> {
  const id = z.uuid().safeParse(despatchId)
  const parsed = despatchDetailsSchema.safeParse(input)
  if (!id.success || !parsed.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("despatches")
    .update({
      despatch_date: parsed.data.date,
      transporter: parsed.data.transporter || null,
      tracking_number: parsed.data.trackingNumber || null,
      vehicle_number: parsed.data.vehicleNumber || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getDespatchErrorMessage(error) }
  if (!data) return { success: false, error: NOT_FOUND }
  return { success: true, data: undefined }
}

// Only packed despatches can be deleted; the database refuses the rest.
export async function deleteDespatch(despatchId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(despatchId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("delete"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("despatches")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getDespatchErrorMessage(error) }
  if (!data) return { success: false, error: "Move it back to Packed before deleting it." }
  return { success: true, data: undefined }
}

// "Total Count: View" on the despatch list. Same filters and search as the list.
export async function countDespatches(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  if (!parsed.success || !(await authorize("view"))) throw new Error(NOT_ALLOWED)

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("despatches").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, DESPATCH_LIST)
  )
  if (error) throw new Error("Failed to count despatches")
  return count ?? 0
}
