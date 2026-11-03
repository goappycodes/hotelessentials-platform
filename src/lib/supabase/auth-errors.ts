import type { AuthError } from "@supabase/supabase-js"

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Please verify your email address before signing in.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
  over_email_send_rate_limit: "Too many emails sent. Please wait before trying again.",
  weak_password: "Please choose a stronger password.",
  same_password: "Your new password must be different from your current password.",
  session_not_found: "Your session has expired. Please request a new link.",
  user_banned: "This account has been deactivated. Contact your administrator.",
  email_exists: "A user with this email address already exists.",
}

export function getAuthErrorMessage(error: AuthError) {
  return (
    (error.code && AUTH_ERROR_MESSAGES[error.code]) ??
    "Something went wrong. Please try again."
  )
}
