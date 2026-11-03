"use client"

import { TriangleAlert } from "lucide-react"
import { useEffect } from "react"

import { APP_NAME, Brand } from "@/components/shared/brand"
import { StatusMessage } from "@/components/shared/status-message"
import { Button } from "@/components/ui/button"
import { getErrorDigest } from "@/lib/errors"
import { fontVariables } from "@/lib/fonts"
import "./globals.css"

export default function GlobalError({
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
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <title>{`Something went wrong · ${APP_NAME}`}</title>
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
          <Brand />
          <StatusMessage
            icon={TriangleAlert}
            tone="destructive"
            title="Something went wrong"
            description="The application failed to load. Please try again in a moment."
            reference={getErrorDigest(error)}
            className="flex-none"
          >
            <Button onClick={retry}>Try again</Button>
          </StatusMessage>
        </main>
      </body>
    </html>
  )
}
