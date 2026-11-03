import type { Metadata } from "next"
import Link from "next/link"

import { ROUTES } from "@/constants/routes"
import { AuthCard } from "@/features/auth/components/auth-card"
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

export const metadata: Metadata = { title: "Forgot password" }

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we will send you a link to reset it."
      footer={
        <Link
          href={ROUTES.login}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
