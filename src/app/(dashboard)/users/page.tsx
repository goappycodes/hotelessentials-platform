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
  UsersTable,
  UsersTableSkeleton,
} from "@/features/users/components/users-table"
import {
  USER_ROLE_FILTER_OPTIONS,
  USER_STATUS_FILTER_OPTIONS,
  USERS_LIST,
} from "@/features/users/list-config"

const navItem = MODULE_NAV_ITEMS.users

export const metadata: Metadata = { title: navItem.title }

export default function UsersPage({ searchParams }: PageProps<"/users">) {
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
            <AccessGate scope={navItem.access}>
              <ListPageActions
                create={navItem.create}
                entityLabel={navItem.title}
                config={USERS_LIST}
              />
            </AccessGate>
          </Suspense>
        }
      />
      <Suspense fallback={<UsersTableSkeleton />}>
        <AccessGate
          scope={navItem.access}
          denied={<AccessDenied area="user management" />}
        >
          <div className="flex flex-wrap gap-2">
            <ListFilterMenu
              config={USERS_LIST}
              filterKey="role"
              label="Role"
              options={USER_ROLE_FILTER_OPTIONS}
            />
            <ListFilterMenu
              config={USERS_LIST}
              filterKey="is_active"
              label="Status"
              options={USER_STATUS_FILTER_OPTIONS}
            />
          </div>
          <UsersTable searchParams={searchParams} />
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}
