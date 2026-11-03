"use server"

import { z } from "zod"

import { isAdminRole } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import { taxRateSchema, type TaxRateInput } from "@/lib/validations/tax"
import type { ActionResult } from "@/types/actions"

// Creates a tax rate (taxId null) or updates one. Owners and admins only.
export async function saveTaxRate(
  taxId: string | null,
  input: TaxRateInput
): Promise<ActionResult<{ id: string }>> {
  const id = taxId === null ? null : z.uuid().safeParse(taxId)
  const parsed = taxRateSchema.safeParse(input)
  if (!parsed.success || (id && !id.success)) {
    return { success: false, error: "Please check the form and try again." }
  }

  const session = await fetchSession()
  if (!session?.user.isActive || !isAdminRole(session.role)) {
    return { success: false, error: "Only owners and admins can manage taxes." }
  }

  const tax = parsed.data
  const isIntraState = tax.taxScope === "Intra-state"
  const row = {
    name: tax.name,
    tax_scope: tax.taxScope,
    cgst_rate: isIntraState ? Number(tax.cgstRate) : null,
    sgst_rate: isIntraState ? Number(tax.sgstRate) : null,
    igst_rate: isIntraState ? null : Number(tax.igstRate),
    is_active: tax.isActive,
  }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("tax_rates").update(row).eq("id", id.data).select("id").maybeSingle()
    : await supabase.from("tax_rates").insert(row).select("id").single()

  if (error?.code === "23505") {
    return { success: false, error: "A tax with this name already exists." }
  }
  if (error?.code === "23514" && error.message.startsWith("This tax")) {
    return { success: false, error: error.message }
  }
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  if (!data) return { success: false, error: "This tax no longer exists." }
  return { success: true, data: { id: data.id } }
}
