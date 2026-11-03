import { Suspense } from "react"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar, AppSidebarSkeleton } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/session"

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebarSkeleton />}>
        <SessionAppSidebar />
      </Suspense>
      {/* min-w-0 lets wide content (tables) scroll inside the page instead of widening it. */}
      <SidebarInset className="min-w-0">
        <AppHeader />
        <main className="flex flex-1 flex-col">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

async function SessionAppSidebar() {
  const { role, permissions } = await requireUser()
  return <AppSidebar access={{ role, permissions }} />
}
