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
import { QuotationStatusBadge } from "@/features/quotations/components/quotation-status-badge"
import type { QuotationRow } from "@/features/quotations/components/quotations-workspace"
import { QUOTATION_COLUMNS } from "@/features/quotations/list-config"
import { prefetchQuotationDetail } from "@/features/quotations/quotation-detail-cache"
import { formatCurrency, formatDay } from "@/lib/format"

const HEAD_CLASS = "h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"

// The full quotations list. A row opens the quotation beside the list.
export function QuotationsTable({
  rows,
  hrefFor,
  onOpen,
}: {
  rows: QuotationRow[]
  hrefFor: (quotationId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, quotationId: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          {QUOTATION_COLUMNS.map((column) => (
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
        {rows.map((quote) => (
          <TableRow key={quote.id} className="relative">
            <TableCell className="px-4 py-3 whitespace-nowrap">{formatDay(quote.quoteDate)}</TableCell>
            <TableCell className="px-4">
              {/* The link covers the whole row, so any cell opens the quotation. */}
              <a
                href={hrefFor(quote.id)}
                onClick={(event) => onOpen(event, quote.id)}
                onMouseEnter={() => prefetchQuotationDetail(quote.id)}
                onFocus={() => prefetchQuotationDetail(quote.id)}
                className="font-medium text-primary after:absolute after:inset-0 hover:underline"
              >
                {quote.quoteNumber}
              </a>
            </TableCell>
            {/* <TableCell className="px-4 text-muted-foreground">
              {quote.referenceNumber ?? "—"}
            </TableCell> */}
            <TableCell className="max-w-64 truncate px-4">{quote.customerName}</TableCell>
            <TableCell className="px-4">
              <QuotationStatusBadge status={quote.status} isExpired={quote.isExpired} />
            </TableCell>
            <TableCell className="px-4 text-right tabular-nums">
              {formatCurrency(quote.total)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function QuotationsTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          {QUOTATION_COLUMNS.map((column) => (
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
