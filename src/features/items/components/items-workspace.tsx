"use client"

import { Ellipsis, ImageIcon, Package, Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback } from "react"

import { countItems } from "@/actions/items"
import { PageContainer } from "@/components/layout/page-container"
import { ListActionsMenu } from "@/components/shared/list-actions-menu"
import { ListFilterMenu } from "@/components/shared/list-filter-menu"
import { ListPagination } from "@/components/shared/list-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"
import { ITEM_PARAM } from "@/constants/routes"
import { ItemPanel, prefetchItemDetail } from "@/features/items/components/item-panel"
import {
  ITEM_STATUS_FILTER_OPTIONS,
  ITEM_TYPE_FILTER_OPTIONS,
  ITEMS_LIST,
} from "@/features/items/list-config"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

const navItem = MODULE_NAV_ITEMS.items

export type ItemRow = {
  id: string
  name: string
  sku: string | null
  type: string
  hsnCode: string | null
  sellingPrice: number
  costPrice: number
  salesEnabled: boolean
  purchaseEnabled: boolean
  isActive: boolean
  thumbnail: string | null
}

const COLUMNS = [
  { label: "Name" },
  { label: "SKU" },
  { label: "Type" },
  { label: "HSN" },
  { label: "Rate", numeric: true },
  { label: "Purchase Rate", numeric: true },
  { label: "Status" },
]

type ItemsWorkspaceProps = {
  rows: ItemRow[]
  hasNextPage: boolean
  isFiltered: boolean
  canCreate: boolean
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
  header,
}: ItemsWorkspaceProps) {
  const router = useRouter()
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
              <ListActionsMenu entityLabel={navItem.title} config={ITEMS_LIST} />
            </Suspense>
          </div>
          <nav aria-label="Items" className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((item) => {
              const isActive = item.id === openId
              return (
                <a
                  key={item.id}
                  href={hrefFor(item.id)}
                  onClick={(event) => open(event, item.id)}
                  onMouseEnter={() => prefetchItemDetail(item.id)}
                  onFocus={() => prefetchItemDetail(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex gap-3 border-b px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
                    isActive && "bg-sidebar-accent hover:bg-sidebar-accent"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "line-clamp-2 font-medium",
                        !item.isActive && "text-muted-foreground"
                      )}
                    >
                      {item.name}
                    </span>
                    {item.sku && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        SKU: {item.sku}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {item.salesEnabled ? formatCurrency(item.sellingPrice) : "—"}
                  </span>
                </a>
              )
            })}
          </nav>
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
      {header}
      <div className="flex flex-wrap gap-2">
        <ListFilterMenu
          config={ITEMS_LIST}
          filterKey="type"
          label="Type"
          options={ITEM_TYPE_FILTER_OPTIONS}
        />
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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.label}
                    className={cn(
                      "h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                      column.numeric && "text-right"
                    )}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id} className="relative">
                  <TableCell className="px-4 py-3">
                    {/* The link covers the whole row, so any cell opens the item. */}
                    <a
                      href={hrefFor(item.id)}
                      onClick={(event) => open(event, item.id)}
                      onMouseEnter={() => prefetchItemDetail(item.id)}
                      onFocus={() => prefetchItemDetail(item.id)}
                      className="flex items-center gap-3 font-medium text-primary after:absolute after:inset-0 hover:underline"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
                        {item.thumbnail ? (
                          <Image
                            src={item.thumbnail}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="size-4" />
                        )}
                      </span>
                      <span className="max-w-64 truncate">{item.name}</span>
                    </a>
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">{item.sku ?? "—"}</TableCell>
                  <TableCell className="px-4">{item.type}</TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {item.hsnCode ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">
                    {item.salesEnabled ? formatCurrency(item.sellingPrice) : "—"}
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">
                    {item.purchaseEnabled ? formatCurrency(item.costPrice) : "—"}
                  </TableCell>
                  <TableCell className="px-4">
                    {item.isActive ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
