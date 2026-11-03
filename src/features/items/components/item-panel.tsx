"use client"

import { Lock, PackageX, Receipt } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { getItemDetail, type ItemDetailData } from "@/actions/items"
import { StatusMessage } from "@/components/shared/status-message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ItemDetailActions } from "@/features/items/components/item-detail-actions"
import { ItemImagesGallery } from "@/features/items/components/item-images-gallery"
import { formatTaxName } from "@/features/taxes/tax-rates"
import { formatCurrency } from "@/lib/format"

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
})

type Loaded = { id: string; data: ItemDetailData | null; failed: boolean }

// Recently loaded items, so hovering a row can start loading before the click and
// reopening an item is instant. Entries expire quickly to stay fresh.
const CACHE_MS = 30_000
const detailCache = new Map<string, { at: number; request: Promise<ItemDetailData | null> }>()

function loadItemDetail(itemId: string) {
  const cached = detailCache.get(itemId)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.request
  const request = getItemDetail(itemId)
  // A failed request is not kept, so the next attempt tries again.
  request.catch(() => detailCache.delete(itemId))
  detailCache.set(itemId, { at: Date.now(), request })
  return request
}

export function prefetchItemDetail(itemId: string) {
  void loadItemDetail(itemId).catch(() => undefined)
}

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
    detailCache.delete(itemId)
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

  const { item, hsnCode, intraTax, interTax, images, can } = loaded.data
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
          <TabsTrigger value="transactions" className="flex-none px-0 py-2.5">
            Transactions
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-none px-0 py-2.5">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="p-6">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="flex flex-col gap-8">
              <DetailList
                rows={[
                  ["Item Type", item.track_inventory ? `${item.type} (inventory item)` : item.type],
                  ["SKU", item.sku],
                  ["Unit", item.unit],
                  ["HSN Code", hsnCode && `${hsnCode.code} · ${hsnCode.description}`],
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
                      ["Purchase Account", item.purchase_account],
                      ["Description", item.purchase_description],
                      ["Preferred Vendor", item.preferred_vendor],
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
                      ["Sales Account", item.sales_account],
                      ["Description", item.sales_description],
                    ]}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">This item isn&apos;t sold.</p>
                )}
              </DetailSection>
            </div>
            <ItemImagesGallery key={item.id} images={images} />
          </div>
        </TabsContent>

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

        <TabsContent value="history" className="p-6">
          <DetailList
            rows={[
              ["Created", dateTimeFormat.format(new Date(item.created_at))],
              ["Last modified", dateTimeFormat.format(new Date(item.updated_at))],
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-medium">{title}</h2>
      {children}
    </section>
  )
}

// Label / value rows, like Zoho's item overview. Empty values show as a dash.
function DetailList({
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
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
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
