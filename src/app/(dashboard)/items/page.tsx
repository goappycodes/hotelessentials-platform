import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { ListPageActions } from "@/components/shared/list-page-actions"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { getItemRows, ItemsTableSkeleton } from "@/features/items/components/item-rows"
import { ItemsWorkspace } from "@/features/items/components/items-workspace"
import { ITEMS_LIST } from "@/features/items/list-config"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.items

export const metadata: Metadata = { title: navItem.title }

export default function ItemsPage({ searchParams }: PageProps<"/items">) {
  return (
    <Suspense fallback={<ItemsPageSkeleton />}>
      <Items searchParams={searchParams} />
    </Suspense>
  )
}

async function Items({ searchParams }: Pick<PageProps<"/items">, "searchParams">) {
  const [session, params] = await Promise.all([requireUser(), searchParams])
  const header = (
    <PageHeader
      title={navItem.title}
      description={navItem.description}
      breadcrumbs={[
        { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
        { label: navItem.title },
      ]}
      actions={
        hasAccess(session, navItem.access) && (
          <ListPageActions
            create={hasAccess(session, navItem.access, "create") ? navItem.create : undefined}
            entityLabel={navItem.title}
            config={ITEMS_LIST}
          />
        )
      }
    />
  )

  if (!hasAccess(session, navItem.access)) {
    return (
      <PageContainer>
        {header}
        <AccessDenied area={navItem.title} />
      </PageContainer>
    )
  }

  const { rows, hasNextPage, isFiltered } = await getItemRows(params)

  return (
    <ItemsWorkspace
      rows={rows}
      hasNextPage={hasNextPage}
      isFiltered={isFiltered}
      canCreate={hasAccess(session, navItem.access, "create")}
      header={header}
    />
  )
}

function ItemsPageSkeleton() {
  return (
    <PageContainer aria-busy="true">
      <span className="sr-only">Loading…</span>
      <PageHeaderSkeleton />
      <ItemsTableSkeleton />
    </PageContainer>
  )
}
