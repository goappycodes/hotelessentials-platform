import type { Metadata } from "next"
import { Suspense } from "react"
import { z } from "zod"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { ListPageActions } from "@/components/shared/list-page-actions"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { ITEM_PARAM } from "@/constants/routes"
import { StockTableSkeleton } from "@/features/inventory/components/stock-table"
import { StockWorkspace } from "@/features/inventory/components/stock-workspace"
import { INVENTORY_LIST } from "@/features/inventory/list-config"
import { getStockRows } from "@/features/inventory/stock-rows"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.inventory
const adjustments = MODULE_NAV_ITEMS.inventoryAdjustments

export const metadata: Metadata = { title: navItem.title }

export default function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  return (
    <Suspense fallback={<InventoryPageSkeleton />}>
      <Inventory searchParams={searchParams} />
    </Suspense>
  )
}

async function Inventory({ searchParams }: Pick<PageProps<"/inventory">, "searchParams">) {
  const [session, params] = await Promise.all([requireUser(), searchParams])
  const canView = hasAccess(session, navItem.access)
  const canAdjustStock = hasAccess(session, adjustments.access, "create")
  const header = (
    <PageHeader
      title={navItem.title}
      description={navItem.description}
      breadcrumbs={[
        { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
        { label: "Inventory" },
        { label: navItem.title },
      ]}
      actions={
        canView && (
          <ListPageActions
            // Stock changes through adjustments, so New here starts one.
            create={canAdjustStock ? adjustments.create : undefined}
            entityLabel={navItem.title}
            config={INVENTORY_LIST}
          />
        )
      }
    />
  )

  if (!canView) {
    return (
      <PageContainer>
        {header}
        <AccessDenied area={navItem.title} />
      </PageContainer>
    )
  }

  const openId = z.uuid().safeParse(params[ITEM_PARAM])
  const { rows, openRow, hasNextPage, isFiltered } = await getStockRows(
    params,
    openId.success ? openId.data : null
  )

  return (
    <StockWorkspace
      rows={rows}
      openRow={openRow}
      hasNextPage={hasNextPage}
      isFiltered={isFiltered}
      canAdjustStock={canAdjustStock}
      canViewItems={hasAccess(session, MODULE_NAV_ITEMS.items.access)}
      canViewOrders={hasAccess(session, MODULE_NAV_ITEMS.salesOrders.access)}
      header={header}
    />
  )
}

function InventoryPageSkeleton() {
  return (
    <PageContainer aria-busy="true">
      <span className="sr-only">Loading…</span>
      <PageHeaderSkeleton />
      <StockTableSkeleton />
    </PageContainer>
  )
}
