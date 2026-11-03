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
  PriceListsTable,
  PriceListsTableSkeleton,
} from "@/features/price-lists/components/price-lists-table"
import {
  PRICE_LIST_STATUS_FILTER_OPTIONS,
  PRICE_LIST_TYPE_FILTER_OPTIONS,
  PRICE_LISTS_LIST,
  TRANSACTION_TYPE_FILTER_OPTIONS,
} from "@/features/price-lists/list-config"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.priceLists

export const metadata: Metadata = { title: navItem.title }

export default function PriceListsPage({ searchParams }: PageProps<"/price-lists">) {
  return (
    <PageContainer>
      <PageHeader
        title={navItem.title}
        description={navItem.description}
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title },
        ]}
        actions={
          <Suspense fallback={<ListPageActionsSkeleton />}>
            <PriceListsPageActions />
          </Suspense>
        }
      />
      <Suspense fallback={<PriceListsTableSkeleton />}>
        <AccessGate scope={navItem.access} denied={<AccessDenied area={navItem.title} />}>
          <div className="flex flex-wrap gap-2">
            <ListFilterMenu
              config={PRICE_LISTS_LIST}
              filterKey="transaction_type"
              label="Transaction"
              options={TRANSACTION_TYPE_FILTER_OPTIONS}
            />
            <ListFilterMenu
              config={PRICE_LISTS_LIST}
              filterKey="price_list_type"
              label="Type"
              options={PRICE_LIST_TYPE_FILTER_OPTIONS}
            />
            <ListFilterMenu
              config={PRICE_LISTS_LIST}
              filterKey="is_active"
              label="Status"
              options={PRICE_LIST_STATUS_FILTER_OPTIONS}
            />
          </div>
          <PriceListsTable searchParams={searchParams} />
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}

async function PriceListsPageActions() {
  const session = await requireUser()
  if (!hasAccess(session, navItem.access)) return null

  return (
    <ListPageActions
      create={hasAccess(session, navItem.access, "create") ? navItem.create : undefined}
      entityLabel={navItem.title}
      config={PRICE_LISTS_LIST}
    />
  )
}
