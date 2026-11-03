import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { z } from "zod"

import { ROUTES } from "@/constants/routes"
import { createClient } from "@/lib/supabase/server"

const otpTypeSchema = z.enum([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
])

function getSafeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.dashboard
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = otpTypeSchema.safeParse(searchParams.get("type"))
  const code = searchParams.get("code")
  const next = getSafeNextPath(searchParams.get("next"))

  const supabase = await createClient()

  if (tokenHash && type.success) {
    const { error } = await supabase.auth.verifyOtp({
      type: type.data,
      token_hash: tokenHash,
    })
    if (!error) redirect(next)
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) redirect(next)
  }

  redirect(ROUTES.authError)
}
