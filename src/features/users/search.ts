import "server-only"

import { ROLE_LABELS } from "@/constants/permissions"
import { userRoute } from "@/constants/routes"
import { USERS_LIST } from "@/features/users/list-config"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

// Header search suggestions for the Users module. Matches the same columns as the list.
export async function searchUsers(term: string, limit: number): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, USERS_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, role, is_active"),
    query
  )
    .order("first_name")
    .limit(limit)
  if (error) throw new Error("Failed to search users")

  return data.map((user) => ({
    id: user.id,
    href: userRoute(user.id),
    title: [user.first_name, user.last_name].filter(Boolean).join(" "),
    details: [
      { value: user.email },
      ...(user.phone ? [{ label: "Phone", value: user.phone }] : []),
      { label: "Role", value: ROLE_LABELS[user.role] },
    ],
    badge: user.is_active
      ? { label: "Active", tone: "success" }
      : { label: "Inactive", tone: "destructive" },
  }))
}
