import "server-only"

import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

import { env } from "@/lib/env"
import type { Database } from "@/types/database"

const secretKey = z.string().min(1).safeParse(process.env.SUPABASE_SECRET_KEY)

// Bypasses RLS. Use it only for Auth admin calls (creating, banning and deleting
// accounts) after the caller has been authorized; read and write tables through the
// user's own client so RLS and the database checks still apply.
export function createAdminClient() {
  if (!secretKey.success) {
    throw new Error("SUPABASE_SECRET_KEY is not set. See .env.example.")
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, secretKey.data, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
