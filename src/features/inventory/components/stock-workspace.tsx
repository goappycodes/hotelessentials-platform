"use client"

import { Warehouse } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

import { countInventoryItems } from "@/actions/inventory"
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
import { ITEM_PARAM } from "@/constants/routes"
import { StockPanel } from "@/features/inventory/components/stock-panel"
import { StockSideList } from "@/features/inventory/components/stock-side-list"
import { StockTable } from "@/features/inventory/components/stock-table"
import {
  INVENTORY_LIST,
  STOCK_STATUS_FILTER_OPTIONS,
} from "@/features/inventory/list-config"
import type { Database } from "@/types/database"

export type StockRow = Database["public"]["Views"]["inventory_list"]["Row"]

// The Stock Levels page. Clicking an item opens it beside the list without leaving the
// page: only the URL's ?item= changes (history.pushState), so Back and shared links work.
export function StockWorkspace({
  rows,
  openRow,
  hasNextPage,
  isFiltered,
  canAdjustStock,
  canViewItems,
  canViewOrders,
  header,
}: {
  rows: StockRow[]
  // The opened item when it isn't among rows (opened from the header search, say).
  openRow: StockRow | null
  hasNextPage: boolean
  isFiltered: boolean
  canAdjustStock: boolean
  canViewItems: boolean
  canViewOrders: boolean
  // The page title and actions shown above the full list.
  header: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openId = searchParams.get(ITEM_PARAM)

  function hrefFor(itemId: string | null) {
    const params = new URLSearchParams(searchParams)
    if (itemId) params.set(ITEM_PARAM, itemId)
    else params.delete(ITEM_PARAM)
    const search = params.toString()
    return search ? `${pathname}?${search}` : pathname
  }

  function open(event: React.MouseEvent<HTMLAnchorElement>, itemId: string) {
    // Let Ctrl/Cmd/Shift-click open a new tab or window as usual.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    window.history.pushState(null, "", hrefFor(itemId))
  }

  function close() {
    window.history.pushState(null, "", hrefFor(null))
  }

  if (openId) {
    // An item from another page goes first in the list, so what's open always shows.
    const sideRows = openRow?.id === openId ? [openRow, ...rows] : rows

    return (
      <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
        <aside className="hidden w-80 shrink-0 flex-col border-r bg-card lg:flex">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <h2 className="flex-1 truncate font-semibold">All Stock</h2>
          </div>
          <StockSideList rows={sideRows} openId={openId} hrefFor={hrefFor} onOpen={open} />
          <div className="shrink-0 border-t bg-card p-2">
            <ListPagination
              config={INVENTORY_LIST}
              itemCount={rows.length}
              hasNextPage={hasNextPage}
              countAction={countInventoryItems}
            />
          </div>
        </aside>
        <section className="min-w-0 flex-1 overflow-y-auto">
          <StockPanel
            row={sideRows.find((item) => item.id === openId)}
            canAdjustStock={canAdjustStock}
            canViewItems={canViewItems}
            canViewOrders={canViewOrders}
            onClose={close}
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
          config={INVENTORY_LIST}
          filterKey="stock_status"
          label="Stock Status"
          options={STOCK_STATUS_FILTER_OPTIONS}
        />
      </div>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Warehouse />
              </EmptyMedia>
              <EmptyTitle>{isFiltered ? "No items found" : "No stock items yet"}</EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No items match your search or filters."
                  : "Items show here once Track Inventory is ticked on them."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <StockTable rows={rows} hrefFor={hrefFor} onOpen={open} />
        )}
      </Card>
      <ListPagination
        config={INVENTORY_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countInventoryItems}
      />
    </PageContainer>
  )
}
