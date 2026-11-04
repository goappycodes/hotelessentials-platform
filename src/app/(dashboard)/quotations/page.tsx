import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { ListPageActions } from "@/components/shared/list-page-actions"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { QuotationsTableSkeleton } from "@/features/quotations/components/quotations-table"
import { QuotationsWorkspace } from "@/features/quotations/components/quotations-workspace"
import { QUOTATIONS_LIST } from "@/features/quotations/list-config"
import { getQuotationRows } from "@/features/quotations/quotation-rows"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.quotations

export const metadata: Metadata = { title: navItem.title }

export default function QuotationsPage({ searchParams }: PageProps<"/quotations">) {
  return (
    <Suspense fallback={<QuotationsPageSkeleton />}>
      <Quotations searchParams={searchParams} />
    </Suspense>
  )
}

async function Quotations({ searchParams }: Pick<PageProps<"/quotations">, "searchParams">) {
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
            config={QUOTATIONS_LIST}
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

  const { rows, hasNextPage, isFiltered } = await getQuotationRows(params)

  return (
    <QuotationsWorkspace
      rows={rows}
      hasNextPage={hasNextPage}
      isFiltered={isFiltered}
      canCreate={hasAccess(session, navItem.access, "create")}
      canEdit={hasAccess(session, navItem.access, "edit")}
      canDelete={hasAccess(session, navItem.access, "delete")}
      header={header}
    />
  )
}

function QuotationsPageSkeleton() {
  return (
    <PageContainer aria-busy="true">
      <span className="sr-only">Loading…</span>
      <PageHeaderSkeleton />
      <QuotationsTableSkeleton />
    </PageContainer>
  )
}
