"use client"

import { Plus, Truck } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { countDespatches } from "@/actions/despatch"
import { PageContainer } from "@/components/layout/page-container"
import { ListFilterMenu } from "@/components/shared/list-filter-menu"
import { ListPagination } from "@/components/shared/list-pagination"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"
import { DESPATCH_PARAM } from "@/constants/routes"
import { DespatchPanel } from "@/features/despatch/components/despatch-panel"
import { DespatchSideList } from "@/features/despatch/components/despatch-side-list"
import { DespatchesTable } from "@/features/despatch/components/despatches-table"
import {
  DESPATCH_LIST,
  DESPATCH_STATUS_FILTER_OPTIONS,
} from "@/features/despatch/list-config"
import type { Tables } from "@/types/database"

const navItem = MODULE_NAV_ITEMS.despatch

export type DespatchRow = Pick<
  Tables<"despatches">,
  | "id"
  | "despatch_number"
  | "despatch_date"
  | "so_number"
  | "customer_name"
  | "transporter"
  | "tracking_number"
  | "status"
> & {
  // Empty on despatches saved before boxes were added.
  boxes: string[]
  sentItems: number
  remainingItems: number
  totalItems: number
}

// The Despatch page. Clicking a despatch opens it beside the list without leaving the page:
// only the URL's ?despatch= changes (history.pushState), so Back and shared links work.
export function DespatchWorkspace({
  rows,
  openRow,
  hasNextPage,
  isFiltered,
  canCreate,
  canEdit,
  canDelete,
  canViewSalesOrders,
  header,
}: {
  rows: DespatchRow[]
  // The opened despatch when it isn't among rows (opened from its sales order, say).
  openRow: DespatchRow | null
  hasNextPage: boolean
  isFiltered: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  // Whether the despatch can link to its sales order.
  canViewSalesOrders: boolean
  // The page title and actions shown above the full list.
  header: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openId = searchParams.get(DESPATCH_PARAM)

  function hrefFor(despatchId: string | null) {
    const params = new URLSearchParams(searchParams)
    if (despatchId) params.set(DESPATCH_PARAM, despatchId)
    else params.delete(DESPATCH_PARAM)
    const search = params.toString()
    return search ? `${pathname}?${search}` : pathname
  }

  function open(event: React.MouseEvent<HTMLAnchorElement>, despatchId: string) {
    // Let Ctrl/Cmd/Shift-click open a new tab or window as usual.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    window.history.pushState(null, "", hrefFor(despatchId))
  }

  function close() {
    window.history.pushState(null, "", hrefFor(null))
  }

  // Reload the list rows from the server after a change in the panel.
  const refreshList = useCallback(() => router.refresh(), [router])

  if (openId) {
    // A despatch from another page goes first in the list, so what's open always shows.
    const sideRows = openRow?.id === openId ? [openRow, ...rows] : rows

    return (
      <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
        <aside className="hidden w-80 shrink-0 flex-col border-r bg-card lg:flex">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <h2 className="flex-1 truncate font-semibold">All Despatches</h2>
            {canCreate && (
              <Button asChild size="icon-sm" aria-label={navItem.create.title}>
                <Link href={navItem.create.href}>
                  <Plus />
                </Link>
              </Button>
            )}
          </div>
          <DespatchSideList rows={sideRows} openId={openId} hrefFor={hrefFor} onOpen={open} />
          <div className="shrink-0 border-t bg-card p-2">
            <ListPagination
              config={DESPATCH_LIST}
              itemCount={rows.length}
              hasNextPage={hasNextPage}
              countAction={countDespatches}
            />
          </div>
        </aside>
        <section className="min-w-0 flex-1 overflow-y-auto">
          <DespatchPanel
            despatchId={openId}
            previewTitle={sideRows.find((despatch) => despatch.id === openId)?.despatch_number}
            canEdit={canEdit}
            canDelete={canDelete}
            canViewSalesOrders={canViewSalesOrders}
            onClose={close}
            onListChange={refreshList}
          />
        </section>
      </div>
    )
  }

  return (
    <PageContainer>
      {header}
      <div className="flex flex-wrap gap-2">
        <ListFilterMenu
          config={DESPATCH_LIST}
          filterKey="status"
          label="Status"
          options={DESPATCH_STATUS_FILTER_OPTIONS}
        />
      </div>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Truck />
              </EmptyMedia>
              <EmptyTitle>{isFiltered ? "No despatches found" : "No despatches yet"}</EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No despatches match your search or filters."
                  : "Pack and send a confirmed sales order with New."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DespatchesTable rows={rows} hrefFor={hrefFor} onOpen={open} />
        )}
      </Card>
      <ListPagination
        config={DESPATCH_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countDespatches}
      />
    </PageContainer>
  )
}
