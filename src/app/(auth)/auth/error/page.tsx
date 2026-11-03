import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import { AuthCard } from "@/features/auth/components/auth-card"

export const metadata: Metadata = { title: "Link expired" }

export default function AuthErrorPage() {
  return (
    <AuthCard
      title="This link is invalid or has expired"
      description="Email links can only be used once and expire after a short time. Request a new one to continue."
    >
      <div className="flex flex-col gap-3">
        <Button asChild>
          <Link href={ROUTES.forgotPassword}>Request a new reset link</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.login}>Back to sign in</Link>
        </Button>
      </div>
    </AuthCard>
  )
}
