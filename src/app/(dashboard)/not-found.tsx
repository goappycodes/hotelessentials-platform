import { FileQuestion } from "lucide-react"
import Link from "next/link"

import { PageContainer } from "@/components/layout/page-container"
import { StatusMessage } from "@/components/shared/status-message"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ROUTES } from "@/constants/routes"

export default function DashboardNotFound() {
  return (
    <PageContainer>
      <Card className="flex-1 py-0">
        <StatusMessage
          icon={FileQuestion}
          title="Record not found"
          description="The record you are looking for does not exist or you do not have access to it."
        >
          <Button asChild>
            <Link href={ROUTES.dashboard}>Go to dashboard</Link>
          </Button>
        </StatusMessage>
      </Card>
    </PageContainer>
  )
}
