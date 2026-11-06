"use client"

import { Lock, PackageX /* , Receipt (Transactions tab) */ } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import type { ItemDetailData /* , ItemStockHistoryEntry */ } from "@/actions/items"
import { StatusMessage } from "@/components/shared/status-message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// For the hidden Transactions tab.
// import {
//   Empty,
//   EmptyDescription,
//   EmptyHeader,
//   EmptyMedia,
//   EmptyTitle,
// } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
// Inventory (stock history table), switched off for now.
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatHsnCode } from "@/features/items/components/hsn-code-field"
import { ItemDetailActions } from "@/features/items/components/item-detail-actions"
import { ItemImagesGallery } from "@/features/items/components/item-images-gallery"
import { invalidateItemDetail, loadItemDetail } from "@/features/items/item-detail-cache"
import { formatTaxName } from "@/features/taxes/tax-rates"
// inventoryAdjustmentRoute comes back with the hidden History tab.
import { ROUTES /* , inventoryAdjustmentRoute */ } from "@/constants/routes"
import {
  formatCurrency,
  // formatDay, // for the hidden History tab
  formatQuantity,
  // formatSignedQuantity, // for the hidden History tab
} from "@/lib/format"
import { cn } from "@/lib/utils"

// For the hidden History tab.
// const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
//   dateStyle: "medium",
//   timeStyle: "short",
// })

type Loaded = { id: string; data: ItemDetailData | null; failed: boolean }

// The opened item beside the list. Loads in the browser, so opening an item never
// leaves the Items page.
export function ItemPanel({
  itemId,
  previewName,
  onClose,
  onListChange,
}: {
  itemId: string
  // Shown straight away from the list while the details load.
  previewName?: string
  onClose: () => void
  // The list beside the panel needs reloading (status changed, item deleted).
  onListChange: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadItemDetail(itemId)
      .then((data) => {
        if (!cancelled) setLoaded({ id: itemId, data, failed: false })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: itemId, data: null, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [itemId, version])

  // After an action: reload this item and the list beside it.
  const reload = useCallback(() => {
    invalidateItemDetail(itemId)
    setVersion((value) => value + 1)
    onListChange()
  }, [itemId, onListChange])

  // Until this item has loaded, show its skeleton (not the previously opened item).
  if (!loaded || loaded.id !== itemId) return <ItemPanelSkeleton title={previewName} />

  if (!loaded.data) {
    return (
      <StatusMessage
        icon={PackageX}
        title={loaded.failed ? "Couldn't load this item" : "This item doesn't exist"}
        description={
          loaded.failed
            ? "Please try again."
            : "It may have been deleted, or you may not have access to it."
        }
      >
        <Button variant="outline" onClick={loaded.failed ? reload : onClose}>
          {loaded.failed ? "Try again" : "Back to items"}
        </Button>
      </StatusMessage>
    )
  }

  const { item, hsnCode, intraTax, interTax, images, stock, can } = loaded.data
  const isTaxable = item.tax_preference === "Taxable"

  return (
    <div className="flex flex-col">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b bg-card px-6 py-2">
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-xl font-semibold">
          <span className="truncate">{item.name}</span>
          {item.is_locked && (
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Locked" />
          )}
          {!item.is_active && <Badge variant="destructive">Inactive</Badge>}
        </h1>
        <ItemDetailActions
          itemId={item.id}
          itemName={item.name}
          isActive={item.is_active}
          isLocked={item.is_locked}
          can={can}
          adjustStock={
            !can.adjustStock
              ? null
              : stock && item.is_active
                ? { href: ROUTES.inventoryAdjustmentsAdd }
                : {
                    blockedReason:
                      item.type === "Service"
                        ? "Services don't have stock."
                        : !stock
                          ? "Edit the item and tick Track Inventory to adjust its stock."
                          : "Mark the item as active to adjust its stock.",
                  }
          }
          onChanged={reload}
          onDeleted={() => {
            onListChange()
            onClose()
          }}
          onClose={onClose}
        />
      </header>

      <Tabs defaultValue="overview" className="gap-0">
        <TabsList variant="line" className="h-auto w-full justify-start gap-4 border-b bg-card px-6">
          <TabsTrigger value="overview" className="flex-none px-0 py-2.5">
            Overview
          </TabsTrigger>
          {/* Transactions and History are hidden for now; uncomment with their tab
              contents below (and the imports marked for them).
          <TabsTrigger value="transactions" className="flex-none px-0 py-2.5">
            Transactions
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-none px-0 py-2.5">
            History
          </TabsTrigger>
          */}
        </TabsList>

        <TabsContent value="overview" className="p-6">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="flex flex-col gap-8">
              <DetailList
                rows={[
                  // Type is hidden for now; uncomment to show it again.
                  // ["Item Type", item.track_inventory ? `${item.type} (inventory item)` : item.type],
                  ["SKU", item.sku],
                  ["Unit", item.unit],
                  ["HSN Code", hsnCode && formatHsnCode(hsnCode)],
                  ["Tax Preference", item.tax_preference],
                  ...(isTaxable
                    ? ([
                        ["Intra State Tax Rate", intraTax && formatTaxName(intraTax)],
                        ["Inter State Tax Rate", interTax && formatTaxName(interTax)],
                      ] as const)
                    : []),
                ]}
              />
              <DetailSection title="Purchase Information">
                {item.purchase_enabled ? (
                  <DetailList
                    rows={[
                      ["Cost Price", formatCurrency(item.cost_price)],
                      // Hidden for now, like on the item form:
                      // ["Purchase Account", item.purchase_account],
                      // ["Description", item.purchase_description],
                      // ["Preferred Vendor", item.preferred_vendor],
                    ]}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">This item isn&apos;t purchased.</p>
                )}
              </DetailSection>
              <DetailSection title="Sales Information">
                {item.sales_enabled ? (
                  <DetailList
                    rows={[
                      ["Selling Price", formatCurrency(item.selling_price)],
                      // Hidden for now, like on the item form:
                      // ["Sales Account", item.sales_account],
                      // ["Description", item.sales_description],
                    ]}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">This item isn&apos;t sold.</p>
                )}
              </DetailSection>
              {stock && (
                <DetailSection title="Inventory Information">
                  <DetailList
                    rows={[
                      // Hidden for now, like on the item form:
                      // ["Inventory Account", item.inventory_account],
                      // ["Inventory Valuation Method", item.inventory_valuation_method],
                      [
                        "Reorder Level",
                        item.reorder_level !== null &&
                          formatQuantity(item.reorder_level, item.unit),
                      ],
                    ]}
                  />
                </DetailSection>
              )}
            </div>
            <div className="flex flex-col gap-6">
              <ItemImagesGallery key={item.id} images={images} />
              {stock && (
                <section aria-label="Stock" className="flex flex-col gap-3 rounded-xl border p-4">
                  <h2 className="font-medium">Stock</h2>
                  <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Stock on Hand</dt>
                    <dd
                      className={cn(
                        "text-right font-medium tabular-nums",
                        stock.onHand === 0 && "text-destructive"
                      )}
                    >
                      {formatQuantity(stock.onHand, item.unit)}
                    </dd>
                  </dl>
                </section>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Transactions and History tabs are hidden for now; uncomment with their
            triggers above.
        <TabsContent value="transactions" className="p-6">
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No transactions yet</EmptyTitle>
              <EmptyDescription>
                Quotations, sales orders and despatches for this item will show here once those
                modules are in use.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </TabsContent>

        <TabsContent value="history" className="flex flex-col gap-8 p-6">
          <DetailList
            rows={[
              ["Created", dateTimeFormat.format(new Date(item.created_at))],
              ["Last modified", dateTimeFormat.format(new Date(item.updated_at))],
            ]}
          />
          {
            // Inventory is switched off for now; uncomment with StockHistory below.
            // {stock && (
            //   <DetailSection title="Inventory Adjustments">
            //     <StockHistory
            //       history={stock.history}
            //       unit={item.unit}
            //       canOpen={can.viewAdjustments}
            //     />
            //   </DetailSection>
            // )}
          }
        </TabsContent>
        */}
      </Tabs>
    </div>
  )
}

/* Inventory is switched off for now; uncomment with the History tab section above
   (and the imports marked for it).

// Adjusted inventory adjustments that changed this item's stock, newest first.
function StockHistory({
  history,
  unit,
  canOpen,
}: {
  history: ItemStockHistoryEntry[]
  unit: string | null
  // The user may open inventory adjustments.
  canOpen: boolean
}) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No inventory adjustments yet. Use Adjust Stock to add or remove stock.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-4 text-xs uppercase">Date</TableHead>
            <TableHead className="px-4 text-xs uppercase">Reason</TableHead>
            <TableHead className="px-4 text-xs uppercase">Reference#</TableHead>
            <TableHead className="px-4 text-right text-xs uppercase">Quantity Adjusted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((entry) => (
            <TableRow key={entry.adjustmentId}>
              <TableCell className="px-4 whitespace-nowrap">
                {canOpen ? (
                  <Link
                    href={inventoryAdjustmentRoute(entry.adjustmentId)}
                    className="text-primary hover:underline"
                  >
                    {formatDay(entry.date)}
                  </Link>
                ) : (
                  formatDay(entry.date)
                )}
              </TableCell>
              <TableCell className="px-4 whitespace-normal">{entry.reason}</TableCell>
              <TableCell className="px-4 text-muted-foreground">
                {entry.referenceNumber ?? "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "px-4 text-right font-medium tabular-nums",
                  entry.quantityAdjusted > 0 ? "text-emerald-700" : "text-destructive"
                )}
              >
                {formatSignedQuantity(entry.quantityAdjusted, unit)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
*/

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-medium">{title}</h2>
      {children}
    </section>
  )
}

// Label / value rows, like Zoho's item overview. Empty values show as a dash.
export function DetailList({
  rows,
}: {
  rows: readonly (readonly [string, string | null | undefined | false])[]
}) {
  return (
    <dl className="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words whitespace-pre-line">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ItemPanelSkeleton({ title }: { title?: string }) {
  return (
    <div aria-busy="true" className="flex flex-col">
      <span className="sr-only">Loading…</span>
      <div className="flex h-14 items-center gap-3 border-b px-6">
        {title ? (
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h1>
        ) : (
          <Skeleton className="h-6 w-64 flex-1" />
        )}
        <Skeleton className="size-7" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-16" />
      </div>
      <div className="flex h-11 items-center gap-4 border-b px-6">
        <Skeleton className="h-4 w-16" />
        {/* Transactions and History tabs, hidden for now.
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
        */}
      </div>
      <div className="grid gap-8 p-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
        <Skeleton className="aspect-[7/6] w-full rounded-xl" />
      </div>
    </div>
  )
}
