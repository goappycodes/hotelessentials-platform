"use client"

import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { ImageIcon } from "lucide-react"
import Image from "next/image"
import { useLayoutEffect, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ItemRow } from "@/features/items/components/items-workspace"
// Hovering a row starts loading its details, so the click feels instant.
import { prefetchItemDetail } from "@/features/items/item-detail-cache"
// formatQuantity is for the Stock on Hand column, switched off for now.
import { formatCurrency /* , formatQuantity */ } from "@/lib/format"
import { cn } from "@/lib/utils"

// A row's height in pixels (36px thumbnail + padding + border); rows are measured once
// drawn, so this only needs to be close.
const ROW_HEIGHT = 61
// Rows drawn above and below the screen, so fast scrolling doesn't show gaps.
const OVERSCAN = 8
// The window size assumed while rendering on the server, so the first screenful of rows
// is in the HTML before the browser takes over.
const SERVER_WINDOW = { width: 1280, height: 900 }

// Fixed column widths (table-fixed), so columns don't shift as rows scroll in and out.
const COLUMNS = [
  { label: "Name" },
  { label: "SKU", width: "w-40" },
  // Type is hidden for now; uncomment with the Type cell below.
  // { label: "Type", width: "w-24" },
  { label: "HSN", width: "w-28" },
  // Inventory is switched off for now; uncomment with the Stock on Hand cell below.
  // { label: "Stock on Hand", numeric: true, width: "w-32" },
  { label: "Rate", numeric: true, width: "w-28" },
  { label: "Purchase Rate", numeric: true, width: "w-32" },
  { label: "Status", width: "w-24" },
]

type ItemsTableProps = {
  rows: ItemRow[]
  // Checkboxes for bulk actions; hidden without edit or delete permission.
  canSelect: boolean
  selectedIds: string[]
  onToggle: (itemId: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  hrefFor: (itemId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, itemId: string) => void
}

// The items list. Only the rows on screen (plus a few either side) are in the page; the
// rest are drawn as you scroll, so long pages (up to 200 items) stay quick.
export function ItemsTable({
  rows,
  canSelect,
  selectedIds,
  onToggle,
  onToggleAll,
  hrefFor,
  onOpen,
}: ItemsTableProps) {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  // Where the rows start on the page, so the window's scroll position maps to rows.
  const [scrollMargin, setScrollMargin] = useState(0)

  // Measured again when what's above the table can change height: the bulk actions bar
  // replacing the header, or the window being resized (headers wrap).
  const hasSelection = selectedIds.length > 0
  useLayoutEffect(() => {
    function measure() {
      if (!bodyRef.current) return
      const top = bodyRef.current.getBoundingClientRect().top + window.scrollY
      setScrollMargin((current) => (Math.abs(top - current) > 1 ? top : current))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [hasSelection])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    scrollMargin,
    initialRect: SERVER_WINDOW,
    getItemKey: (index) => rows[index]?.id ?? index,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const paddingTop = virtualRows.length ? virtualRows[0].start - scrollMargin : 0
  const paddingBottom = virtualRows.length
    ? virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - scrollMargin)
    : 0
  const columnCount = COLUMNS.length + (canSelect ? 1 : 0)
  const allSelected = rows.length > 0 && selectedIds.length === rows.length

  return (
    // The Name column takes the space left over; at least ~20rem on narrow screens.
    <Table className="min-w-[60rem] table-fixed">
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          {canSelect && (
            <TableHead className="w-10 pr-0 pl-4">
              <Checkbox
                aria-label="Select all items on this page"
                checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
              />
            </TableHead>
          )}
          {COLUMNS.map((column) => (
            <TableHead
              key={column.label}
              className={cn(
                "h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                column.width,
                column.numeric && "text-right"
              )}
            >
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody ref={bodyRef}>
        {/* Space for the rows above the screen, so the scrollbar and positions are right. */}
        {paddingTop > 0 && (
          <tr aria-hidden="true">
            <td colSpan={columnCount} style={{ height: paddingTop, padding: 0 }} />
          </tr>
        )}
        {virtualRows.map((virtualRow) => {
          const item = rows[virtualRow.index]
          const isSelected = selectedIds.includes(item.id)
          return (
            <TableRow
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="relative"
              data-state={isSelected ? "selected" : undefined}
            >
              {canSelect && (
                // Just above the row-wide link (z-1), so ticking doesn't open the item,
                // but below the sticky header and its search dropdown (z-10).
                <TableCell className="relative z-[1] w-10 pr-0 pl-4">
                  <Checkbox
                    aria-label={`Select ${item.name}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => onToggle(item.id, checked === true)}
                  />
                </TableCell>
              )}
              <TableCell className="px-4 py-3">
                {/* The link covers the whole row, so any cell opens the item. */}
                <a
                  href={hrefFor(item.id)}
                  onClick={(event) => onOpen(event, item.id)}
                  onMouseEnter={() => prefetchItemDetail(item.id)}
                  onFocus={() => prefetchItemDetail(item.id)}
                  className="flex min-w-0 items-center gap-3 font-medium text-primary after:absolute after:inset-0 hover:underline"
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
                  <span className="min-w-0 truncate" title={item.name}>
                    {item.name}
                  </span>
                </a>
              </TableCell>
              <TableCell className="truncate px-4 text-muted-foreground">
                {item.sku ?? "—"}
              </TableCell>
              {/* Type is hidden for now; uncomment with the column above.
              <TableCell className="px-4">{item.type}</TableCell>
              */}
              <TableCell className="px-4 text-muted-foreground">{item.hsnCode ?? "—"}</TableCell>
              {/* Inventory is switched off for now; uncomment with the column above.
              <TableCell className="px-4 text-right tabular-nums">
                {item.stockOnHand === null ? "—" : formatQuantity(item.stockOnHand, item.unit)}
              </TableCell>
              */}
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
          )
        })}
        {paddingBottom > 0 && (
          <tr aria-hidden="true">
            <td colSpan={columnCount} style={{ height: paddingBottom, padding: 0 }} />
          </tr>
        )}
      </TableBody>
    </Table>
  )
}
