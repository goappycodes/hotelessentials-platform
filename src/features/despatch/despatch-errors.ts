import type { PostgrestError } from "@supabase/supabase-js"

import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"

export function getDespatchErrorMessage(error: PostgrestError) {
  if (error.code === "P0002") return error.message
  if (error.code === "42501") return "You don't have permission to do that."
  // Messages written for users by the database ("Not enough stock of …").
  if (["23514", "23503"].includes(error.code) && !error.message.includes("violates")) {
    return error.message
  }
  return getDatabaseErrorMessage(error)
}
