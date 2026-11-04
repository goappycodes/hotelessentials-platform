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
import { CustomersActionsMenu } from "@/features/customers/components/customers-actions-menu"
import {
  CustomersTable,
  CustomersTableSkeleton,
} from "@/features/customers/components/customers-table"
import {
  CUSTOMER_STATUS_FILTER_OPTIONS,
  CUSTOMER_TYPE_FILTER_OPTIONS,
  CUSTOMERS_LIST,
} from "@/features/customers/list-config"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.customers

export const metadata: Metadata = { title: navItem.title }

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <PageContainer>
      <PageHeader
        title={navItem.title}
        description={navItem.description}
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: "Sales" },
          { label: navItem.title },
        ]}
        actions={
          <Suspense fallback={<ListPageActionsSkeleton />}>
            <CustomersPageActions />
          </Suspense>
        }
      />
      <Suspense fallback={<CustomersTableSkeleton />}>
        <AccessGate scope={navItem.access} denied={<AccessDenied area={navItem.title} />}>
          <div className="flex flex-wrap gap-2">
            <ListFilterMenu
              config={CUSTOMERS_LIST}
              filterKey="customer_type"
              label="Type"
              options={CUSTOMER_TYPE_FILTER_OPTIONS}
            />
            <ListFilterMenu
              config={CUSTOMERS_LIST}
              filterKey="is_active"
              label="Status"
              options={CUSTOMER_STATUS_FILTER_OPTIONS}
            />
          </div>
          <CustomersTable searchParams={searchParams} />
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}

async function CustomersPageActions() {
  const session = await requireUser()
  if (!hasAccess(session, navItem.access)) return null

  return (
    <ListPageActions
      create={hasAccess(session, navItem.access, "create") ? navItem.create : undefined}
      entityLabel={navItem.title}
      config={CUSTOMERS_LIST}
      menu={
        <CustomersActionsMenu
          entityLabel={navItem.title}
          canImport={hasAccess(session, navItem.access, "create")}
        />
      }
    />
  )
}
