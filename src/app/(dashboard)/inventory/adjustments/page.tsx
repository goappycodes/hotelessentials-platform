import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { AccessGate } from "@/components/shared/access-gate"
import { ListFilterMenu } from "@/components/shared/list-filter-menu"
import {
  ListPageActions,
  ListPageActionsSkeleton,
} from "@/components/shared/list-page-actions"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import {
  AdjustmentsTable,
  AdjustmentsTableSkeleton,
} from "@/features/inventory-adjustments/components/adjustments-table"
import {
  ADJUSTMENT_STATUS_FILTER_OPTIONS,
  INVENTORY_ADJUSTMENTS_LIST,
} from "@/features/inventory-adjustments/list-config"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.inventoryAdjustments

export const metadata: Metadata = { title: navItem.title }

export default function InventoryAdjustmentsPage({
  searchParams,
}: PageProps<"/inventory/adjustments">) {
  return (
    <PageContainer>
      <PageHeader
        title={navItem.title}
        description={navItem.description}
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: "Inventory" },
          { label: navItem.title },
        ]}
        actions={
          <Suspense fallback={<ListPageActionsSkeleton />}>
            <AdjustmentsPageActions />
          </Suspense>
        }
      />
      <Suspense fallback={<AdjustmentsTableSkeleton />}>
        <AccessGate scope={navItem.access} denied={<AccessDenied area={navItem.title} />}>
          <div className="flex flex-wrap gap-2">
            <ListFilterMenu
              config={INVENTORY_ADJUSTMENTS_LIST}
              filterKey="status"
              label="Status"
              options={ADJUSTMENT_STATUS_FILTER_OPTIONS}
            />
          </div>
          <AdjustmentsTable searchParams={searchParams} />
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}

async function AdjustmentsPageActions() {
  const session = await requireUser()
  if (!hasAccess(session, navItem.access)) return null

  return (
    <ListPageActions
      create={hasAccess(session, navItem.access, "create") ? navItem.create : undefined}
      entityLabel={navItem.title}
      config={INVENTORY_ADJUSTMENTS_LIST}
    />
  )
}
