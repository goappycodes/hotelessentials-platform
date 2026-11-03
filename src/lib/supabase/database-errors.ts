import type { PostgrestError } from "@supabase/supabase-js"

// Messages raised on purpose by our database functions are safe to show as-is.
const USER_FACING_CODES = new Set(["42501", "P0002"])

export function getDatabaseErrorMessage(error: PostgrestError) {
  if (USER_FACING_CODES.has(error.code)) return error.message
  if (error.code === "23505") return "That record already exists."
  return "Something went wrong. Please try again."
}
