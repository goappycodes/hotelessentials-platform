import { NextResponse, type NextRequest } from "next/server"

import { ROUTES } from "@/constants/routes"
import { fetchSession } from "@/lib/session"
import { createClient } from "@/lib/supabase/server"

// Server Components cannot clear auth cookies, so a deactivated user is sent here.
// Active users are sent back to the app, so this link cannot sign anyone out at will.
export async function GET(request: NextRequest) {
  const session = await fetchSession()

  if (session?.user.isActive) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url))
  }

  if (session) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  return NextResponse.redirect(new URL(ROUTES.loginDeactivated, request.url))
}
