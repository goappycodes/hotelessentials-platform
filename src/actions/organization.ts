"use server"

import { z } from "zod"

import { isAdminRole } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import {
  companyProfileSchema,
  type CompanyProfileInput,
} from "@/lib/validations/company-profile"
import type { ActionResult } from "@/types/actions"

// The business's details printed on quotations. Owners and admins only; the database
// enforces it as well.
export async function saveCompanyProfile(input: CompanyProfileInput): Promise<ActionResult> {
  const parsed = companyProfileSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Please check the form and try again." }
  const session = await fetchSession()
  if (!session?.user.isActive || !isAdminRole(session.role)) {
    return { success: false, error: "Only owners and admins can change this." }
  }

  const orNull = (value: string) => value || null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organization_settings")
    .update({
      company_name: orNull(parsed.data.companyName),
      address: orNull(parsed.data.address),
      phone: orNull(parsed.data.phone),
      email: orNull(parsed.data.email),
      gstin: orNull(parsed.data.gstin),
      bank_details: orNull(parsed.data.bankDetails),
    })
    .eq("id", true)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  if (!data) return { success: false, error: "The details couldn't be saved." }
  return { success: true, data: undefined }
}

const stateSchema =z.union([z.string().regex(/^[0-9]{2}$/), z.literal("")])

// The business's GST state, which decides CGST + SGST or IGST on quotations. Owners and
// admins only; the database enforces it as well.
export async function setBusinessState(stateCode: string): Promise<ActionResult> {
  const parsed = stateSchema.safeParse(stateCode)
  if (!parsed.success) return { success: false, error: "Pick a state." }
  const session = await fetchSession()
  if (!session?.user.isActive || !isAdminRole(session.role)) {
    return { success: false, error: "Only owners and admins can change this." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organization_settings")
    .update({ gst_state_code: parsed.data || null })
    .eq("id", true)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  if (!data) return { success: false, error: "The setting couldn't be saved." }
  return { success: true, data: undefined }
}
