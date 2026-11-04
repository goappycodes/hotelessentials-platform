"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import { isAdminRole } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import { directTaxSchema, type DirectTaxInput } from "@/lib/validations/direct-tax"
import type { ActionResult } from "@/types/actions"
import type { Tables } from "@/types/database"

const NOT_ALLOWED = "Only owners and admins can change TDS and TCS rates."

export type DirectTaxRate = Pick<Tables<"direct_tax_rates">, "id" | "kind" | "name" | "rate" | "is_active">

async function authorize() {
  const session = await fetchSession()
  return session?.user.isActive && isAdminRole(session.role)
}

function errorMessage(error: PostgrestError) {
  if (error.code === "23505") return "There is already a rate with this name."
  return getDatabaseErrorMessage(error)
}

// Adds a TDS or TCS rate (id null) or changes one. Quotations keep the name and rate
// they were saved with.
export async function saveDirectTax(
  id: string | null,
  input: DirectTaxInput
): Promise<ActionResult<DirectTaxRate>> {
  const parsed = directTaxSchema.safeParse(input)
  const parsedId = id === null ? null : z.uuid().safeParse(id)
  if (!parsed.success || (parsedId && !parsedId.success)) {
    return { success: false, error: "Please check the form and try again." }
  }
  if (!(await authorize())) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const values = {
    kind: parsed.data.kind,
    name: parsed.data.name,
    rate: Number(parsed.data.rate),
  }
  const { data, error } = parsedId
    ? await supabase
        .from("direct_tax_rates")
        .update({ name: values.name, rate: values.rate, updated_at: new Date().toISOString() })
        .eq("id", parsedId.data)
        .select("id, kind, name, rate, is_active")
        .maybeSingle()
    : await supabase
        .from("direct_tax_rates")
        .insert(values)
        .select("id, kind, name, rate, is_active")
        .maybeSingle()
  if (error) return { success: false, error: errorMessage(error) }
  if (!data) return { success: false, error: "This rate no longer exists." }
  return { success: true, data }
}

// Inactive rates aren't offered on new quotations.
export async function setDirectTaxActive(id: string, isActive: boolean): Promise<ActionResult> {
  const parsedId = z.uuid().safeParse(id)
  if (!parsedId.success) return { success: false, error: "Please try again." }
  if (!(await authorize())) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("direct_tax_rates")
    .update({ is_active: isActive === true, updated_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: errorMessage(error) }
  if (!data) return { success: false, error: "This rate no longer exists." }
  return { success: true, data: undefined }
}
