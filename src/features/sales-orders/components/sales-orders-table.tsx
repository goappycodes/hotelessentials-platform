"use client"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SalesOrderStatusBadge } from "@/features/sales-orders/components/sales-order-status-badge"
import type { SalesOrderRow } from "@/features/sales-orders/components/sales-orders-workspace"
import { SALES_ORDER_COLUMNS } from "@/features/sales-orders/list-config"
import { prefetchSalesOrderDetail } from "@/features/sales-orders/sales-order-detail-cache"
import { formatCurrency, formatDay } from "@/lib/format"

const HEAD_CLASS = "h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"

// The full sales orders list. A row opens the order beside the list.
export function SalesOrdersTable({
  rows,
  hrefFor,
  onOpen,
}: {
  rows: SalesOrderRow[]
  hrefFor: (salesOrderId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, salesOrderId: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          {SALES_ORDER_COLUMNS.map((column) => (
            <TableHead
              key={column}
              className={column === "Amount" ? `${HEAD_CLASS} text-right` : HEAD_CLASS}
            >
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((order) => (
          <TableRow key={order.id} className="relative">
            <TableCell className="px-4 py-3 whitespace-nowrap">{formatDay(order.orderDate)}</TableCell>
            <TableCell className="px-4">
              {/* The link covers the whole row, so any cell opens the order. */}
              <a
                href={hrefFor(order.id)}
                onClick={(event) => onOpen(event, order.id)}
                onMouseEnter={() => prefetchSalesOrderDetail(order.id)}
                onFocus={() => prefetchSalesOrderDetail(order.id)}
                className="font-medium text-primary after:absolute after:inset-0 hover:underline"
              >
                {order.soNumber}
              </a>
            </TableCell>
            <TableCell className="px-4 text-muted-foreground">{order.quoteNumber ?? "—"}</TableCell>
            <TableCell className="max-w-64 truncate px-4">{order.customerName}</TableCell>
            <TableCell className="px-4">
              <SalesOrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell className="px-4 text-right tabular-nums">
              {formatCurrency(order.total)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function SalesOrdersTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          {SALES_ORDER_COLUMNS.map((column) => (
            <Skeleton key={column} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </Card>
    </div>
  )
}
