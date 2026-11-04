"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import { PAGE_SIZE_OPTIONS } from "@/constants/list"
import type { PermissionAction } from "@/constants/permissions"
import { toContactRows, toCustomerRow } from "@/features/customers/customer-input"
import { CUSTOMERS_LIST } from "@/features/customers/list-config"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import { customerSchema, type CustomerInput } from "@/lib/validations/customer"
import type { ActionResult } from "@/types/actions"

const INVALID_INPUT = "Please check the form and try again."
const NOT_ALLOWED = "You don't have permission to do that."

async function authorize(action: PermissionAction) {
  const session = await fetchSession()
  if (!session?.user.isActive) return null
  return hasAccess(session, "customers", action) ? session : null
}

function getCustomerErrorMessage(error: PostgrestError) {
  if (error.code === "P0002") return "This customer no longer exists."
  if (error.message.includes("gstin_for_registered")) return "Enter the customer's GSTIN."
  if (error.message.includes("exemption_reason_for_exempt")) {
    return "Enter why the customer is exempt from tax."
  }
  return getDatabaseErrorMessage(error)
}

// Creates a customer (customerId null) or updates one, with its contact persons, in one
// database transaction (public.save_customer).
export async function saveCustomer(
  customerId: string | null,
  input: CustomerInput
): Promise<ActionResult<{ id: string }>> {
  const id = customerId === null ? null : z.uuid().safeParse(customerId)
  const parsed = customerSchema.safeParse(input)
  if (!parsed.success || (id && !id.success)) return { success: false, error: INVALID_INPUT }
  if (!(await authorize(id ? "edit" : "create"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("save_customer", {
    target_id: id ? id.data : null,
    customer: toCustomerRow(parsed.data),
    contacts: toContactRows(parsed.data.contacts),
  })
  if (error) return { success: false, error: getCustomerErrorMessage(error) }
  return { success: true, data: { id: data } }
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(customerId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("delete"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getCustomerErrorMessage(error) }
  if (!data) return { success: false, error: "This customer no longer exists." }
  return { success: true, data: undefined }
}

// Customers picked with the list checkboxes: at most one page.
const customerIdsSchema = z.array(z.uuid()).min(1).max(Math.max(...PAGE_SIZE_OPTIONS))

export type BulkCustomersResult = { changed: number }

// Mark as Active / Mark as Inactive for the selected customers.
export async function setCustomersActive(
  customerIds: string[],
  isActive: boolean
): Promise<ActionResult<BulkCustomersResult>> {
  const ids = customerIdsSchema.safeParse(customerIds)
  if (!ids.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .update({ is_active: isActive === true })
    .in("id", ids.data)
    .select("id")
  if (error) return { success: false, error: getCustomerErrorMessage(error) }
  return { success: true, data: { changed: data.length } }
}

// Delete for the selected customers (their contact persons go with them).
export async function deleteCustomers(
  customerIds: string[]
): Promise<ActionResult<BulkCustomersResult>> {
  const ids = customerIdsSchema.safeParse(customerIds)
  if (!ids.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("delete"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .delete()
    .in("id", ids.data)
    .select("id")
  if (error) return { success: false, error: getCustomerErrorMessage(error) }
  return { success: true, data: { changed: data.length } }
}

const countFiltersSchema = z.record(z.string(), z.string())

// "Total Count: View" on the customers list. Same filters and search as the list.
export async function countCustomers(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  if (!parsed.success || !(await authorize("view"))) throw new Error(NOT_ALLOWED)

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("customers").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, CUSTOMERS_LIST)
  )
  if (error) throw new Error("Failed to count customers")
  return count ?? 0
}
