import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  GUEST_ONLY_ROUTES,
  PUBLIC_ROUTE_PREFIXES,
  ROUTES,
} from "@/constants/routes"
import { env } from "@/lib/env"
import type { Database } from "@/types/database"

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value)
          )
        },
      },
    }
  )

  // Must run immediately after creating the client: it refreshes an expired session.
  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims)

  const { pathname } = request.nextUrl

  if (PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return response
  }

  if (GUEST_ONLY_ROUTES.includes(pathname)) {
    return isAuthenticated ? redirect(request, response, ROUTES.dashboard) : response
  }

  if (!isAuthenticated) {
    const target =
      pathname === ROUTES.resetPassword ? ROUTES.forgotPassword : ROUTES.login
    return redirect(request, response, target)
  }

  if (pathname === ROUTES.home) {
    return redirect(request, response, ROUTES.dashboard)
  }

  return response
}

function redirect(request: NextRequest, source: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""

  const redirectResponse = NextResponse.redirect(url)
  source.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
  source.headers.forEach((value, key) => {
    if (key.toLowerCase() === "cache-control") {
      redirectResponse.headers.set(key, value)
    }
  })
  return redirectResponse
}
