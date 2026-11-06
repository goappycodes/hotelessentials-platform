"use client"

import { useEffect, useRef } from "react"

import type { SalesOrderRow } from "@/features/sales-orders/components/sales-orders-workspace"
import { prefetchSalesOrderDetail } from "@/features/sales-orders/sales-order-detail-cache"
import { formatCurrency, formatDay } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS_TEXT_CLASS: Record<SalesOrderRow["status"], string> = {
  Draft: "text-muted-foreground",
  Confirmed: "text-sky-700",
  Closed: "text-emerald-700",
}

// The narrow list beside an opened sales order: customer, amount, number, date and status.
export function SalesOrdersSideList({
  rows,
  openId,
  hrefFor,
  onOpen,
}: {
  rows: SalesOrderRow[]
  openId: string
  hrefFor: (salesOrderId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, salesOrderId: string) => void
}) {
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Opening an order far down the table: bring it into view here. Only when the list
  // first appears, so clicking within the list doesn't make it jump.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" })
  }, [])

  return (
    <nav aria-label="Sales orders" className="min-h-0 flex-1 overflow-y-auto">
      {rows.map((order) => {
        const isActive = order.id === openId
        return (
          <a
            key={order.id}
            ref={isActive ? activeRef : undefined}
            href={hrefFor(order.id)}
            onClick={(event) => onOpen(event, order.id)}
            onMouseEnter={() => prefetchSalesOrderDetail(order.id)}
            onFocus={() => prefetchSalesOrderDetail(order.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col gap-0.5 border-b px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
              isActive && "bg-sidebar-accent hover:bg-sidebar-accent"
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="truncate font-medium">{order.customerName}</span>
              <span className="shrink-0 tabular-nums">{formatCurrency(order.total)}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {order.soNumber} • {formatDay(order.orderDate)}
            </span>
            <span className={cn("text-[11px] font-semibold uppercase", STATUS_TEXT_CLASS[order.status])}>
              {order.status}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
