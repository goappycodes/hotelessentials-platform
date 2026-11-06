"use client"

import { ClipboardList } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { countSalesOrders } from "@/actions/sales-orders"
import { PageContainer } from "@/components/layout/page-container"
import { ListFilterMenu } from "@/components/shared/list-filter-menu"
import { ListPagination } from "@/components/shared/list-pagination"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { SALES_ORDER_PARAM } from "@/constants/routes"
import { SalesOrderPanel } from "@/features/sales-orders/components/sales-order-panel"
import { SalesOrdersSideList } from "@/features/sales-orders/components/sales-orders-side-list"
import { SalesOrdersTable } from "@/features/sales-orders/components/sales-orders-table"
import {
  SALES_ORDER_STATUS_FILTER_OPTIONS,
  SALES_ORDERS_LIST,
} from "@/features/sales-orders/list-config"
import type { Enums } from "@/types/database"

export type SalesOrderRow = {
  id: string
  orderDate: string
  soNumber: string
  quoteNumber: string
  customerName: string
  status: Enums<"sales_order_status">
  total: number
}

// The Sales Orders page. Clicking an order opens it beside the list without leaving the
// page: only the URL's ?order= changes (history.pushState), so Back and shared links work.
export function SalesOrdersWorkspace({
  rows,
  openRow,
  hasNextPage,
  isFiltered,
  canEdit,
  canDelete,
  canViewQuotations,
  header,
}: {
  rows: SalesOrderRow[]
  // The opened order when it isn't among rows (opened from its quotation, say).
  openRow: SalesOrderRow | null
  hasNextPage: boolean
  isFiltered: boolean
  canEdit: boolean
  canDelete: boolean
  // Whether the order can link to the quotation it came from.
  canViewQuotations: boolean
  // The page title and actions shown above the full list.
  header: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openId = searchParams.get(SALES_ORDER_PARAM)

  function hrefFor(salesOrderId: string | null) {
    const params = new URLSearchParams(searchParams)
    if (salesOrderId) params.set(SALES_ORDER_PARAM, salesOrderId)
    else params.delete(SALES_ORDER_PARAM)
    const search = params.toString()
    return search ? `${pathname}?${search}` : pathname
  }

  function open(event: React.MouseEvent<HTMLAnchorElement>, salesOrderId: string) {
    // Let Ctrl/Cmd/Shift-click open a new tab or window as usual.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    window.history.pushState(null, "", hrefFor(salesOrderId))
  }

  function close() {
    window.history.pushState(null, "", hrefFor(null))
  }

  // Reload the list rows from the server after a change in the panel.
  const refreshList = useCallback(() => router.refresh(), [router])

  if (openId) {
    // An order from another page goes first in the list, so what's open always shows.
    const sideRows = openRow?.id === openId ? [openRow, ...rows] : rows

    return (
      <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
        <aside className="hidden w-80 shrink-0 flex-col border-r bg-card lg:flex">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <h2 className="flex-1 truncate font-semibold">All Sales Orders</h2>
          </div>
          <SalesOrdersSideList rows={sideRows} openId={openId} hrefFor={hrefFor} onOpen={open} />
          <div className="shrink-0 border-t bg-card p-2">
            <ListPagination
              config={SALES_ORDERS_LIST}
              itemCount={rows.length}
              hasNextPage={hasNextPage}
              countAction={countSalesOrders}
            />
          </div>
        </aside>
        <section className="min-w-0 flex-1 overflow-y-auto">
          <SalesOrderPanel
            salesOrderId={openId}
            previewTitle={sideRows.find((order) => order.id === openId)?.soNumber}
            canEdit={canEdit}
            canDelete={canDelete}
            canViewQuotations={canViewQuotations}
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
          config={SALES_ORDERS_LIST}
          filterKey="status"
          label="Status"
          options={SALES_ORDER_STATUS_FILTER_OPTIONS}
        />
      </div>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>{isFiltered ? "No sales orders found" : "No sales orders yet"}</EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No sales orders match your search or filters."
                  : "An order appears here when a quotation is accepted."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <SalesOrdersTable rows={rows} hrefFor={hrefFor} onOpen={open} />
        )}
      </Card>
      <ListPagination
        config={SALES_ORDERS_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countSalesOrders}
      />
    </PageContainer>
  )
}
