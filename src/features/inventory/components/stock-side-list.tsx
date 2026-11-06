"use client"

import { useEffect, useRef } from "react"

import type { StockRow } from "@/features/inventory/components/stock-workspace"
import { formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS_TEXT_CLASS: Record<StockRow["stock_status"], string> = {
  "In Stock": "text-emerald-700",
  "Low Stock": "text-amber-700",
  "Out of Stock": "text-destructive",
}

// The narrow list beside an opened item: name, available stock, SKU and status.
export function StockSideList({
  rows,
  openId,
  hrefFor,
  onOpen,
}: {
  rows: StockRow[]
  openId: string
  hrefFor: (itemId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, itemId: string) => void
}) {
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Opening an item far down the table: bring it into view here. Only when the list
  // first appears, so clicking within the list doesn't make it jump.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" })
  }, [])

  return (
    <nav aria-label="Stock items" className="min-h-0 flex-1 overflow-y-auto">
      {rows.map((item) => {
        const isActive = item.id === openId
        return (
          <a
            key={item.id}
            ref={isActive ? activeRef : undefined}
            href={hrefFor(item.id)}
            onClick={(event) => onOpen(event, item.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col gap-0.5 border-b px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
              isActive && "bg-sidebar-accent hover:bg-sidebar-accent"
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="truncate font-medium">{item.name}</span>
              <span className="shrink-0 tabular-nums">
                {formatQuantity(item.available_stock, item.unit)}
              </span>
            </span>
            <span className="truncate text-xs text-muted-foreground">SKU: {item.sku ?? "—"}</span>
            <span
              className={cn(
                "text-[11px] font-semibold uppercase",
                STATUS_TEXT_CLASS[item.stock_status]
              )}
            >
              {item.stock_status}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
