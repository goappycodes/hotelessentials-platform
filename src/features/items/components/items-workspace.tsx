"use client"

import { Ellipsis, Package, Plus } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useState } from "react"

import { countItems } from "@/actions/items"
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
import { ITEM_PARAM } from "@/constants/routes"
import { ItemPanel } from "@/features/items/components/item-panel"
import { ItemsActionsMenu } from "@/features/items/components/items-actions-menu"
import { ItemsBulkActions } from "@/features/items/components/items-bulk-actions"
import { ItemsSideList } from "@/features/items/components/items-side-list"
import { ItemsTable } from "@/features/items/components/items-table"
import {
  ITEM_STATUS_FILTER_OPTIONS,
  // ITEM_TYPE_FILTER_OPTIONS, // for the hidden Type filter
  ITEMS_LIST,
} from "@/features/items/list-config"

const navItem = MODULE_NAV_ITEMS.items

export type ItemRow = {
  id: string
  name: string
  sku: string | null
  type: string
  hsnCode: string | null
  unit: string | null
  // Null when the item doesn't track inventory.
  stockOnHand: number | null
  sellingPrice: number
  costPrice: number
  salesEnabled: boolean
  purchaseEnabled: boolean
  isActive: boolean
  thumbnail: string | null
}

type ItemsWorkspaceProps = {
  rows: ItemRow[]
  hasNextPage: boolean
  isFiltered: boolean
  canCreate: boolean
  // Bulk actions on items picked with the checkboxes.
  canEdit: boolean
  canDelete: boolean
  // The page title and actions shown above the full list.
  header: React.ReactNode
}

// The Items page. Clicking an item opens it beside the list without leaving the page:
// only the URL's ?item= changes (history.pushState), so Back and shared links still work.
export function ItemsWorkspace({
  rows,
  hasNextPage,
  isFiltered,
  canCreate,
  canEdit,
  canDelete,
  header,
}: ItemsWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openId = searchParams.get(ITEM_PARAM)
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  // Only items on this page count, so changing page, filters or search drops the rest.
  const selectedIds = checkedIds.filter((id) => rows.some((item) => item.id === id))
  const canSelect = canEdit || canDelete

  function toggle(itemId: string, checked: boolean) {
    setCheckedIds((ids) => (checked ? [...ids, itemId] : ids.filter((id) => id !== itemId)))
  }

  const clearSelection = useCallback(() => setCheckedIds([]), [])

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

  // Reload the list rows from the server after a change in the panel.
  const refreshList = useCallback(() => router.refresh(), [router])

  if (openId) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
        <aside className="hidden w-80 shrink-0 flex-col border-r bg-card lg:flex">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <h2 className="flex-1 truncate font-semibold">All Items</h2>
            {canCreate && (
              <Button asChild size="icon-sm" aria-label={navItem.create.title}>
                <Link href={navItem.create.href}>
                  <Plus />
                </Link>
              </Button>
            )}
            <Suspense
              fallback={
                <Button variant="outline" size="icon" disabled aria-label="More actions">
                  <Ellipsis />
                </Button>
              }
            >
              <ItemsActionsMenu entityLabel={navItem.title} canImport={canCreate} />
            </Suspense>
          </div>
          <ItemsSideList rows={rows} openId={openId} hrefFor={hrefFor} onOpen={open} />
        </aside>
        <section className="min-w-0 flex-1 overflow-y-auto">
          <ItemPanel
            itemId={openId}
            previewName={rows.find((item) => item.id === openId)?.name}
            onClose={close}
            onListChange={refreshList}
          />
        </section>
      </div>
    )
  }

  return (
    <PageContainer>
      {/* With items checked, Zoho's bulk actions bar takes the header's place. */}
      {selectedIds.length > 0 ? (
        <ItemsBulkActions
          selectedIds={selectedIds}
          canEdit={canEdit}
          canDelete={canDelete}
          onClear={clearSelection}
          onChanged={refreshList}
        />
      ) : (
        header
      )}
      <div className="flex flex-wrap gap-2">
        {/* Type is hidden for now (every new item is Goods). Uncomment to filter by it again.
        <ListFilterMenu
          config={ITEMS_LIST}
          filterKey="type"
          label="Type"
          options={ITEM_TYPE_FILTER_OPTIONS}
        />
        */}
        <ListFilterMenu
          config={ITEMS_LIST}
          filterKey="is_active"
          label="Status"
          options={ITEM_STATUS_FILTER_OPTIONS}
        />
      </div>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package />
              </EmptyMedia>
              <EmptyTitle>{isFiltered ? "No items found" : "No items yet"}</EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No items match your search or filters."
                  : "Add the goods and services you sell or buy."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemsTable
            rows={rows}
            canSelect={canSelect}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={(checked) => setCheckedIds(checked ? rows.map((item) => item.id) : [])}
            hrefFor={hrefFor}
            onOpen={open}
          />
        )}
      </Card>
      <ListPagination
        config={ITEMS_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countItems}
      />
    </PageContainer>
  )
}
