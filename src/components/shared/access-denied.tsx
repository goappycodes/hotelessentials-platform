import { ShieldX } from "lucide-react"
import Link from "next/link"

import { StatusMessage } from "@/components/shared/status-message"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ROUTES } from "@/constants/routes"

export function AccessDenied({ area }: { area: string }) {
  return (
    <Card className="flex-1 justify-center py-0">
      <StatusMessage
        icon={ShieldX}
        tone="destructive"
        title="You don't have access to this page"
        description={`Ask an owner or admin if you need access to ${area}.`}
      >
        <Button asChild variant="outline">
          <Link href={ROUTES.dashboard}>Back to dashboard</Link>
        </Button>
      </StatusMessage>
    </Card>
  )
}
