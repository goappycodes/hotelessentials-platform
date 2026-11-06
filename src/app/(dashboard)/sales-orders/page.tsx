import type { Metadata } from "next"
import { Suspense } from "react"
import { z } from "zod"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { ListPageActions } from "@/components/shared/list-page-actions"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { SALES_ORDER_PARAM } from "@/constants/routes"
import { SalesOrdersTableSkeleton } from "@/features/sales-orders/components/sales-orders-table"
import { SalesOrdersWorkspace } from "@/features/sales-orders/components/sales-orders-workspace"
import { SALES_ORDERS_LIST } from "@/features/sales-orders/list-config"
import { getSalesOrderRows } from "@/features/sales-orders/sales-order-rows"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.salesOrders

export const metadata: Metadata = { title: navItem.title }

export default function SalesOrdersPage({ searchParams }: PageProps<"/sales-orders">) {
  return (
    <Suspense fallback={<SalesOrdersPageSkeleton />}>
      <SalesOrders searchParams={searchParams} />
    </Suspense>
  )
}

async function SalesOrders({ searchParams }: Pick<PageProps<"/sales-orders">, "searchParams">) {
  const [session, params] = await Promise.all([requireUser(), searchParams])
  const canView = hasAccess(session, navItem.access)
  const header = (
    <PageHeader
      title={navItem.title}
      description={navItem.description}
      breadcrumbs={[
        { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
        { label: "Sales" },
        { label: navItem.title },
      ]}
      actions={
        canView && <ListPageActions entityLabel={navItem.title} config={SALES_ORDERS_LIST} />
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

  const openId = z.uuid().safeParse(params[SALES_ORDER_PARAM])
  const { rows, openRow, hasNextPage, isFiltered } = await getSalesOrderRows(
    params,
    openId.success ? openId.data : null
  )

  return (
    <SalesOrdersWorkspace
      rows={rows}
      openRow={openRow}
      hasNextPage={hasNextPage}
      isFiltered={isFiltered}
      canEdit={hasAccess(session, navItem.access, "edit")}
      canDelete={hasAccess(session, navItem.access, "delete")}
      canViewQuotations={hasAccess(session, MODULE_NAV_ITEMS.quotations.access)}
      header={header}
    />
  )
}

function SalesOrdersPageSkeleton() {
  return (
    <PageContainer aria-busy="true">
      <span className="sr-only">Loading…</span>
      <PageHeaderSkeleton />
      <SalesOrdersTableSkeleton />
    </PageContainer>
  )
}
