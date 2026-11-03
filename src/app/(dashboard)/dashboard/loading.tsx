import { PageContainer } from "@/components/layout/page-container"
import { DashboardGreetingSkeleton } from "@/features/dashboard/components/dashboard-greeting"
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview"

export default function DashboardLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="border-b bg-card px-4 py-5 md:px-6 lg:px-8">
        <DashboardGreetingSkeleton />
      </div>
      <PageContainer>
        <DashboardOverviewSkeleton />
      </PageContainer>
    </div>
  )
}
