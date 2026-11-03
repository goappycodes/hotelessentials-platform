import "server-only"

import { cacheLife } from "next/cache"
import { redirect } from "next/navigation"

import type { UserRole } from "@/constants/permissions"
import { ROUTES } from "@/constants/routes"
import {
  toModulePermissions,
  type ModulePermissions,
  type UserAccess,
} from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export type SessionUser = {
  id: string
  email: string
  firstName: string
  fullName: string
  role: UserRole
  isActive: boolean
}

export type SessionContext = UserAccess & {
  user: SessionUser
  permissions: ModulePermissions
}

// Reads the signed-in user, their profile and their permissions with one token check
// and two parallel queries. Always hits Supabase; use it where freshness matters.
export async function fetchSession(): Promise<SessionContext | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null

  const userId = data.claims.sub
  const [profileResult, permissionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, first_name, last_name, role, is_active")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_permissions")
      .select("module, can_view, can_create, can_edit, can_delete")
      .eq("user_id", userId),
  ])

  if (profileResult.error || permissionsResult.error) {
    throw new Error("Failed to load the user profile")
  }

  const profile = profileResult.data
  if (!profile) return null

  return {
    user: {
      id: userId,
      email: profile.email,
      firstName: profile.first_name,
      fullName: [profile.first_name, profile.last_name].filter(Boolean).join(" "),
      role: profile.role,
      isActive: profile.is_active,
    },
    role: profile.role,
    permissions: toModulePermissions(permissionsResult.data),
  }
}

// Rendering path: cached privately in the browser so navigations and the prefetched
// App Shell reuse it. Auth Server Actions call refresh() to clear it.
async function getCachedSession() {
  "use cache: private"
  cacheLife({ stale: 300 })
  return fetchSession()
}

export async function requireUser() {
  const session = await getCachedSession()
  if (!session) redirect(ROUTES.login)
  if (!session.user.isActive) redirect(ROUTES.authSignOutDeactivated)
  return session
}
