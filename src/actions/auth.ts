"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"

import { ROUTES } from "@/constants/routes"
import { env } from "@/lib/env"
import { getAuthErrorMessage } from "@/lib/supabase/auth-errors"
import { createClient } from "@/lib/supabase/server"
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth"
import type { ActionResult } from "@/types/actions"

const INVALID_INPUT = "Please check the form and try again."

function confirmUrl(next: string) {
  const url = new URL(ROUTES.authConfirm, env.NEXT_PUBLIC_SITE_URL)
  url.searchParams.set("next", next)
  return url.toString()
}

export async function signIn(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: INVALID_INPUT }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { success: false, error: getAuthErrorMessage(error) }

  refresh()
  redirect(ROUTES.dashboard)
}

export async function requestPasswordReset(
  input: ForgotPasswordInput
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: INVALID_INPUT }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: confirmUrl(ROUTES.resetPassword),
  })

  // Only surface rate limiting so the response never reveals whether an account exists.
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { success: false, error: getAuthErrorMessage(error) }
  }

  return { success: true, data: undefined }
}

export async function updatePassword(
  input: ResetPasswordInput
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: INVALID_INPUT }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) {
    return {
      success: false,
      error: "Your reset link has expired. Please request a new one.",
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (error) return { success: false, error: getAuthErrorMessage(error) }

  refresh()
  return { success: true, data: undefined }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  refresh()
  redirect(ROUTES.login)
}
