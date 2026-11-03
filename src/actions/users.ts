"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { USERS_LIST } from "@/features/users/list-config"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { isAdminRole, toPermissionRows } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuthErrorMessage } from "@/lib/supabase/auth-errors"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/user"
import type { ActionResult } from "@/types/actions"

const INVALID_INPUT = "Please check the form and try again."
const NOT_ALLOWED = "Only owners and admins can manage users."
// Supabase bans for a duration; a century keeps a deactivated account blocked.
const DEACTIVATED_BAN_DURATION = "876000h"

async function authorizeAdmin() {
  const session = await fetchSession()
  if (!session?.user.isActive || !isAdminRole(session.role)) return null
  return session
}

function toSaveUserArgs(
  userId: string,
  input: Omit<UpdateUserInput, "isActive">,
  isActive: boolean
) {
  return {
    target_user_id: userId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    role: input.role,
    is_active: isActive,
    permissions: toPermissionRows(input.permissions),
  }
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: INVALID_INPUT }

  const session = await authorizeAdmin()
  if (!session) return { success: false, error: NOT_ALLOWED }
  if (parsed.data.role === "owner" && session.role !== "owner") {
    return { success: false, error: "Only an owner can add another owner." }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
    },
  })
  if (error) return { success: false, error: getAuthErrorMessage(error) }

  // Role and permissions are saved as the signed-in admin, so the database rules apply.
  const supabase = await createClient()
  const { error: saveError } = await supabase.rpc(
    "save_user",
    toSaveUserArgs(data.user.id, parsed.data, true)
  )
  if (saveError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { success: false, error: getDatabaseErrorMessage(saveError) }
  }

  return { success: true, data: undefined }
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<ActionResult> {
  const id = userIdSchema.safeParse(userId)
  const parsed = updateUserSchema.safeParse(input)
  if (!id.success || !parsed.success) return { success: false, error: INVALID_INPUT }

  const session = await authorizeAdmin()
  if (!session) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { error } = await supabase.rpc(
    "save_user",
    toSaveUserArgs(id.data, parsed.data, parsed.data.isActive)
  )
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }

  // RLS already blocks an inactive user's data access; the ban also stops sign-in.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(
    id.data,
    { ban_duration: parsed.data.isActive ? "none" : DEACTIVATED_BAN_DURATION }
  )
  if (banError) {
    return {
      success: false,
      error:
        "The user was updated, but sign-in access could not be changed. Please update again.",
    }
  }

  // Your own name shows in the header and is cached in the session.
  if (id.data === session.user.id) refresh()
  return { success: true, data: undefined }
}

const countFiltersSchema = z.record(z.string(), z.string())

// "Total Count: View" on the users list. Counts with the same filters and search as the list.
export async function countUsers(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  const session = await authorizeAdmin()
  if (!parsed.success || !session) throw new Error(NOT_ALLOWED)

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, USERS_LIST)
  )
  if (error) throw new Error("Failed to count users")
  return count ?? 0
}
