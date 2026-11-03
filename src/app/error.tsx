"use client"

import { TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

import { Brand } from "@/components/shared/brand"
import { StatusMessage } from "@/components/shared/status-message"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import { getErrorDigest } from "@/lib/errors"

export default function RootError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <Brand />
      <StatusMessage
        icon={TriangleAlert}
        tone="destructive"
        title="Something went wrong"
        description="An unexpected error occurred. Please try again, and contact support if it keeps happening."
        reference={getErrorDigest(error)}
        className="flex-none"
      >
        <Button onClick={retry}>Try again</Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.dashboard}>Go to dashboard</Link>
        </Button>
      </StatusMessage>
    </main>
  )
}
