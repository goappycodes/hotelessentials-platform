import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { env } from "@/lib/env"
import type { Database } from "@/types/database"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot write cookies; the proxy refreshes the session instead.
          }
        },
      },
    }
  )
}

// For uncached reads while rendering a Server Component. supabase-js reads the clock
// (Date.now()) to check the session, which Cache Components rejects during prerendering;
// connection() defers the read to request time. Not needed in Server Actions or Route
// Handlers, and not allowed inside "use cache".
export async function createRequestClient() {
  await connection()
  return createClient()
}
