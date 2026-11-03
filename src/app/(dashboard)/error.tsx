"use client"

import { TriangleAlert } from "lucide-react"
import { useEffect } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { StatusMessage } from "@/components/shared/status-message"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getErrorDigest } from "@/lib/errors"

export default function DashboardError({
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
    <PageContainer>
      <Card className="flex-1 py-0">
        <StatusMessage
          icon={TriangleAlert}
          tone="destructive"
          title="Something went wrong"
          description="We could not load this page. Please try again."
          reference={getErrorDigest(error)}
        >
          <Button onClick={retry}>Try again</Button>
        </StatusMessage>
      </Card>
    </PageContainer>
  )
}
