import { PageContainer } from "@/components/layout/page-container"
import { PageHeaderSkeleton } from "@/components/layout/page-header"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PageSkeleton() {
  return (
    <PageContainer aria-busy="true">
      <span className="sr-only">Loading…</span>
      <PageHeaderSkeleton />
      <Card className="flex-1 items-center justify-center gap-3 py-16">
        <Skeleton className="size-10 rounded-lg" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full max-w-xs" />
        <Skeleton className="h-4 w-full max-w-60" />
      </Card>
    </PageContainer>
  )
}
