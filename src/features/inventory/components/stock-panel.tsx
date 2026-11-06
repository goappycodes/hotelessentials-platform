"use client"

import { PackageX, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { getStockDetail, type StockDetail } from "@/actions/inventory"
import { StatusMessage } from "@/components/shared/status-message"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ROUTES,
  itemRoute,
  salesOrderRoute,
} from "@/constants/routes"
import { StockStatusBadge } from "@/features/inventory/components/stock-status-badge"
import type { StockRow } from "@/features/inventory/components/stock-workspace"
import { ItemImagesGallery } from "@/features/items/components/item-images-gallery"
import { DetailList, DetailSection } from "@/features/items/components/item-panel"
import { formatDay, formatQuantity, formatSignedQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"

type Loaded = { id: string; data: StockDetail | null }

const HEAD_CLASS = "px-4 text-xs uppercase"

// The opened item beside the stock list. Its stock comes from the list row, so it shows
// straight away and always matches the list; images, orders and history load after it.
export function StockPanel({
  row,
  canAdjustStock,
  canViewItems,
  canViewOrders,
  onClose,
}: {
  // Undefined when the item doesn't track inventory, or is inactive or deleted.
  row: StockRow | undefined
  canAdjustStock: boolean
  canViewItems: boolean
  canViewOrders: boolean
  onClose: () => void
}) {
  const itemId = row?.id
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    getStockDetail(itemId)
      .then((data) => {
        if (!cancelled) setLoaded({ id: itemId, data })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: itemId, data: null })
      })
    return () => {
      cancelled = true
    }
  }, [itemId, version])

  if (!row) {
    return (
      <StatusMessage
        icon={PackageX}
        title="This item isn't in stock"
        description="It may be inactive or deleted, or Track Inventory may be off for it."
      >
        <Button variant="outline" onClick={onClose}>
          Back to stock
        </Button>
      </StatusMessage>
    )
  }

  // Until this item has loaded, its details show as skeletons (not the previous item's).
  const isLoading = !loaded || loaded.id !== row.id
  const detail = isLoading ? null : loaded.data
  const failed = !isLoading && !detail
  const quantity = (value: number) => formatQuantity(value, row.unit)
  const retry = () => {
    setLoaded(null)
    setVersion((value) => value + 1)
  }

  return (
    <div className="flex flex-col">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b bg-card px-6 py-2">
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-xl font-semibold">
          <span className="truncate">{row.name}</span>
          <StockStatusBadge status={row.stock_status} />
        </h1>
        {canViewItems && (
          <Button asChild variant="outline" size="sm">
            <Link href={itemRoute(row.id)}>View Item</Link>
          </Button>
        )}
        {canAdjustStock && (
          <Button asChild size="sm">
            <Link href={ROUTES.inventoryAdjustmentsAdd}>Adjust Stock</Link>
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </header>

      <Tabs defaultValue="overview" className="gap-0">
        <TabsList variant="line" className="h-auto w-full justify-start gap-4 border-b bg-card px-6">
          <TabsTrigger value="overview" className="flex-none px-0 py-2.5">
            Overview
          </TabsTrigger>
          {canViewOrders && (
            <TabsTrigger value="orders" className="flex-none px-0 py-2.5">
              Confirmed Orders
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="flex-none px-0 py-2.5">
            Stock History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="p-6">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="flex flex-col gap-8">
              <DetailList
                rows={[
                  ["SKU", row.sku],
                  ["Unit", row.unit],
                ]}
              />
              <DetailSection title="Stock Information">
                <DetailList
                  rows={[
                    ["Current Stock", quantity(row.current_stock)],
                    ["Reserved Stock", quantity(row.reserved_stock)],
                    ["Available Stock", quantity(row.available_stock)],
                    ["Ordered Quantity", quantity(row.ordered_quantity)],
                    ["Incoming Stock", quantity(row.incoming_stock)],
                    ["Reorder Level", row.reorder_level !== null && quantity(row.reorder_level)],
                  ]}
                />
              </DetailSection>
            </div>
            {isLoading ? (
              <Skeleton className="aspect-[7/6] w-full rounded-xl" />
            ) : (
              <ItemImagesGallery key={row.id} images={detail?.images ?? []} />
            )}
          </div>
        </TabsContent>

        {canViewOrders && (
          <TabsContent value="orders" className="p-6">
            {failed ? (
              <LoadFailed onRetry={retry} />
            ) : detail?.orders ? (
              <ConfirmedOrders orders={detail.orders} unit={row.unit} />
            ) : (
              <StockTabSkeleton />
            )}
          </TabsContent>
        )}

        <TabsContent value="history" className="p-6">
          {failed ? (
            <LoadFailed onRetry={retry} />
          ) : detail ? (
            <StockHistory history={detail.history} unit={row.unit} />
          ) : (
            <StockTabSkeleton />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Confirmed sales orders that include this item: what makes up its ordered quantity.
function ConfirmedOrders({
  orders,
  unit,
}: {
  orders: NonNullable<StockDetail["orders"]>
  unit: string | null
}) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No confirmed sales orders for this item.</p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className={HEAD_CLASS}>Date</TableHead>
            <TableHead className={HEAD_CLASS}>Sales Order#</TableHead>
            <TableHead className={HEAD_CLASS}>Customer</TableHead>
            <TableHead className={cn(HEAD_CLASS, "text-right")}>Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="px-4 whitespace-nowrap">{formatDay(order.date)}</TableCell>
              <TableCell className="px-4">
                <Link href={salesOrderRoute(order.id)} className="text-primary hover:underline">
                  {order.soNumber}
                </Link>
              </TableCell>
              <TableCell className="max-w-64 truncate px-4">{order.customerName}</TableCell>
              <TableCell className="px-4 text-right font-medium tabular-nums">
                {formatQuantity(order.quantity, unit)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Adjustments and despatches that changed this item's stock, newest first.
function StockHistory({
  history,
  unit,
}: {
  history: StockDetail["history"]
  unit: string | null
}) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No stock changes yet. Use Adjust Stock to add or remove stock.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className={HEAD_CLASS}>Date</TableHead>
            <TableHead className={HEAD_CLASS}>Reason</TableHead>
            <TableHead className={HEAD_CLASS}>Reference#</TableHead>
            <TableHead className={cn(HEAD_CLASS, "text-right")}>Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="px-4 whitespace-nowrap">
                {entry.href ? (
                  <Link href={entry.href} className="text-primary hover:underline">
                    {formatDay(entry.date)}
                  </Link>
                ) : (
                  formatDay(entry.date)
                )}
              </TableCell>
              <TableCell className="px-4 whitespace-normal">{entry.reason ?? "—"}</TableCell>
              <TableCell className="px-4 text-muted-foreground">
                {entry.referenceNumber ?? "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "px-4 text-right font-medium tabular-nums",
                  entry.quantity > 0 ? "text-emerald-700" : "text-destructive"
                )}
              >
                {formatSignedQuantity(entry.quantity, unit)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">Couldn&apos;t load this.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function StockTabSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  )
}
