import { CircleAlert } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AuthCard } from "@/features/auth/components/auth-card"
import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to your hotelessentials account."
      // footer={<p>Accounts are created by your administrator.</p>}
    >
      <Suspense>
        <LoginNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </AuthCard>
  )
}

async function LoginNotice({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { reason } = await searchParams
  if (reason !== "deactivated") return null

  return (
    <Alert variant="destructive" className="mb-4">
      <CircleAlert />
      <AlertTitle>Your account has been deactivated</AlertTitle>
      <AlertDescription>
        Contact your administrator if you need access again.
      </AlertDescription>
    </Alert>
  )
}
