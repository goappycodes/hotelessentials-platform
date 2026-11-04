"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef } from "react"

import type { ItemRow } from "@/features/items/components/items-workspace"
import { prefetchItemDetail } from "@/features/items/item-detail-cache"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

// A row's height in pixels with a one-line name and a SKU; rows are measured once drawn
// (names can wrap to two lines), so this only needs to be close.
const ROW_HEIGHT = 62
const OVERSCAN = 8

type ItemsSideListProps = {
  rows: ItemRow[]
  openId: string
  hrefFor: (itemId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, itemId: string) => void
}

// The narrow list beside an opened item. Like the main table, only the rows in view are
// in the page; the rest are drawn as the list scrolls.
export function ItemsSideList({ rows, openId, hrefFor, onOpen }: ItemsSideListProps) {
  const scrollRef = useRef<HTMLElement>(null)
  // The React Compiler isn't enabled here; TanStack Virtual works as a plain hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    initialRect: { width: 320, height: 800 },
    getItemKey: (index) => rows[index]?.id ?? index,
  })

  // Opening an item far down the table: bring it into view in this list. Only when the
  // list first appears, so clicking within the list doesn't make it jump.
  useEffect(() => {
    const index = rows.findIndex((item) => item.id === openId)
    if (index > 0) virtualizer.scrollToIndex(index, { align: "center" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <nav ref={scrollRef} aria-label="Items" className="min-h-0 flex-1 overflow-y-auto">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = rows[virtualRow.index]
          const isActive = item.id === openId
          return (
            <a
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              href={hrefFor(item.id)}
              onClick={(event) => onOpen(event, item.id)}
              onMouseEnter={() => prefetchItemDetail(item.id)}
              onFocus={() => prefetchItemDetail(item.id)}
              aria-current={isActive ? "page" : undefined}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              className={cn(
                "absolute inset-x-0 top-0 flex gap-3 border-b px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
                isActive && "bg-sidebar-accent hover:bg-sidebar-accent"
              )}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={cn("line-clamp-2 font-medium", !item.isActive && "text-muted-foreground")}
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
      </div>
    </nav>
  )
}
