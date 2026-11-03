import type { Metadata } from "next"
import Link from "next/link"

import { Brand } from "@/components/shared/brand"
import { StatusMessage } from "@/components/shared/status-message"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <Brand />
      <StatusMessage
        code="404"
        title="Page not found"
        description="The page you are looking for does not exist or has been moved."
        className="flex-none"
      >
        <Button asChild>
          <Link href={ROUTES.dashboard}>Go to dashboard</Link>
        </Button>
      </StatusMessage>
    </main>
  )
}
