import type { Metadata } from "next"
import { Suspense } from "react"
import { z } from "zod"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { ListPageActions } from "@/components/shared/list-page-actions"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { DESPATCH_PARAM } from "@/constants/routes"
import { DespatchWorkspace } from "@/features/despatch/components/despatch-workspace"
import { DespatchesTableSkeleton } from "@/features/despatch/components/despatches-table"
import { getDespatchRows } from "@/features/despatch/despatch-rows"
import { DESPATCH_LIST } from "@/features/despatch/list-config"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.despatch

export const metadata: Metadata = { title: navItem.title }

export default function DespatchPage({ searchParams }: PageProps<"/despatch">) {
  return (
    <Suspense fallback={<DespatchPageSkeleton />}>
      <Despatch searchParams={searchParams} />
    </Suspense>
  )
}

async function Despatch({ searchParams }: Pick<PageProps<"/despatch">, "searchParams">) {
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
        canView && (
          <ListPageActions
            create={hasAccess(session, navItem.access, "create") ? navItem.create : undefined}
            entityLabel={navItem.title}
            config={DESPATCH_LIST}
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

  const openId = z.uuid().safeParse(params[DESPATCH_PARAM])
  const { rows, openRow, hasNextPage, isFiltered } = await getDespatchRows(
    params,
    openId.success ? openId.data : null
  )

  return (
    <DespatchWorkspace
      rows={rows}
      openRow={openRow}
      hasNextPage={hasNextPage}
      isFiltered={isFiltered}
      canCreate={hasAccess(session, navItem.access, "create")}
      canEdit={hasAccess(session, navItem.access, "edit")}
      canDelete={hasAccess(session, navItem.access, "delete")}
      canViewSalesOrders={hasAccess(session, MODULE_NAV_ITEMS.salesOrders.access)}
      header={header}
    />
  )
}

function DespatchPageSkeleton() {
  return (
    <PageContainer aria-busy="true">
      <span className="sr-only">Loading…</span>
      <PageHeaderSkeleton />
      <DespatchesTableSkeleton />
    </PageContainer>
  )
}
