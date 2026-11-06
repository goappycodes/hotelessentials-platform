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
import { StockStatusBadge } from "@/features/inventory/components/stock-status-badge"
import type { StockRow } from "@/features/inventory/components/stock-workspace"
import { formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"

const COLUMNS = [
  { label: "Item Name" },
  { label: "SKU" },
  { label: "Current Stock", numeric: true },
  { label: "Reserved Stock", numeric: true },
  { label: "Available Stock", numeric: true },
  { label: "Ordered Quantity", numeric: true },
  { label: "Incoming Stock", numeric: true },
  { label: "Reorder Level", numeric: true },
  { label: "Stock Status" },
]

// The full stock list. A row opens the item beside the list.
export function StockTable({
  rows,
  hrefFor,
  onOpen,
}: {
  rows: StockRow[]
  hrefFor: (itemId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, itemId: string) => void
}) {
  return (
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
            <TableCell className="max-w-80 truncate px-4 py-3">
              {/* The link covers the whole row, so any cell opens the item. */}
              <a
                href={hrefFor(item.id)}
                onClick={(event) => onOpen(event, item.id)}
                className="font-medium text-primary after:absolute after:inset-0 hover:underline"
              >
                {item.name}
              </a>
            </TableCell>
            <TableCell className="px-4 text-muted-foreground">{item.sku ?? "—"}</TableCell>
            <Quantity value={item.current_stock} />
            <Quantity value={item.reserved_stock} />
            <Quantity value={item.available_stock} className="font-medium" />
            <Quantity value={item.ordered_quantity} />
            <Quantity value={item.incoming_stock} />
            <Quantity value={item.reorder_level} />
            <TableCell className="px-4">
              <StockStatusBadge status={item.stock_status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Quantity({ value, className }: { value: number | null; className?: string }) {
  return (
    <TableCell className={cn("px-4 text-right tabular-nums", className)}>
      {value === null ? "—" : formatQuantity(value)}
    </TableCell>
  )
}

export function StockTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          {COLUMNS.map((column) => (
            <Skeleton key={column.label} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-4 py-3">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-40" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  )
}
