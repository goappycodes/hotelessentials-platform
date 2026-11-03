import type { Metadata } from "next"

import { AuthCard } from "@/features/auth/components/auth-card"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"

export const metadata: Metadata = { title: "Set a new password" }

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password you have not used before."
    >
      <ResetPasswordForm />
    </AuthCard>
  )
}
