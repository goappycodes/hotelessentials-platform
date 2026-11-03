import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader, type BreadcrumbEntry } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { AccessGate } from "@/components/shared/access-gate"
import {
  ListPageActions,
  ListPageActionsSkeleton,
} from "@/components/shared/list-page-actions"
import {
  ListPagination,
  ListPaginationSkeleton,
} from "@/components/shared/list-pagination"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { DEFAULT_LIST_CONFIG } from "@/constants/list"
import { DASHBOARD_NAV_ITEM, type NavItem } from "@/constants/navigation"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

type ModulePlaceholderProps = {
  module: NavItem
  mode?: "list" | "create"
}

export function ModulePlaceholder({ module, mode = "list" }: ModulePlaceholderProps) {
  const create = mode === "create" ? module.create : undefined
  const title = create?.title ?? module.title

  const breadcrumbs: BreadcrumbEntry[] = [
    { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
    ...(create
      ? [{ label: module.title, href: module.href }, { label: create.title }]
      : [{ label: module.title }]),
  ]

  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={module.description}
        breadcrumbs={breadcrumbs}
        actions={
          mode === "list" && module.create ? (
            <Suspense fallback={<ListPageActionsSkeleton />}>
              <ModuleListActions module={module} />
            </Suspense>
          ) : undefined
        }
      />
      <Suspense fallback={<ModuleBodySkeleton />}>
        <AccessGate
          scope={module.access}
          action={mode === "create" ? "create" : "view"}
          denied={<AccessDenied area={module.title} />}
        >
          <Card className="flex-1 py-0">
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <module.icon />
                </EmptyMedia>
                <EmptyTitle>{title} is coming soon</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </Card>
          {mode === "list" && module.create && (
            <Suspense fallback={<ListPaginationSkeleton />}>
              <ListPagination
                config={DEFAULT_LIST_CONFIG}
                itemCount={0}
                hasNextPage={false}
                totalCount={0}
              />
            </Suspense>
          )}
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}

async function ModuleListActions({ module }: { module: NavItem }) {
  const session = await requireUser()
  if (module.access && !hasAccess(session, module.access)) return null
  const canCreate = !module.access || hasAccess(session, module.access, "create")

  return (
    <ListPageActions
      create={canCreate ? module.create : undefined}
      entityLabel={module.title}
      config={DEFAULT_LIST_CONFIG}
    />
  )
}

function ModuleBodySkeleton() {
  return (
    <Card aria-busy="true" className="flex-1 items-center justify-center gap-3 py-16">
      <span className="sr-only">Loading…</span>
      <Skeleton className="size-10 rounded-lg" />
      <Skeleton className="h-5 w-48" />
    </Card>
  )
}
