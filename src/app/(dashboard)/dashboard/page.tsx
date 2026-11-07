import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { DASHBOARD_NAV_ITEM } from "@/constants/navigation"
import {
  DashboardGreeting,
  DashboardGreetingSkeleton,
} from "@/features/dashboard/components/dashboard-greeting"
import {
  DashboardOverview,
  DashboardOverviewSkeleton,
} from "@/features/dashboard/components/dashboard-overview"

export const metadata: Metadata = { title: DASHBOARD_NAV_ITEM.title }

export default function DashboardPage() {
  return (
    <>
      <div className="border-b bg-card px-4 py-5 md:px-6 lg:px-8">
        <Suspense fallback={<DashboardGreetingSkeleton />}>
          <DashboardGreeting />
        </Suspense>
      </div>
      <PageContainer>
        <Suspense fallback={<DashboardOverviewSkeleton />}>
          <DashboardOverview />
        </Suspense>
      </PageContainer>
    </>
  )
}
