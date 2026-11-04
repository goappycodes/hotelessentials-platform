"use client"

import { useEffect, useRef } from "react"

import type { QuotationRow } from "@/features/quotations/components/quotations-workspace"
import { prefetchQuotationDetail } from "@/features/quotations/quotation-detail-cache"
import { formatCurrency, formatDay } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS_TEXT_CLASS: Record<string, string> = {
  Draft: "text-muted-foreground",
  Sent: "text-sky-700",
  Accepted: "text-emerald-700",
  Declined: "text-destructive",
  Expired: "text-amber-700",
}

// The narrow list beside an opened quotation, like Zoho's: customer, amount, number,
// date and status.
export function QuotationsSideList({
  rows,
  openId,
  hrefFor,
  onOpen,
}: {
  rows: QuotationRow[]
  openId: string
  hrefFor: (quotationId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, quotationId: string) => void
}) {
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Opening a quotation far down the table: bring it into view here. Only when the list
  // first appears, so clicking within the list doesn't make it jump.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" })
  }, [])

  return (
    <nav aria-label="Quotations" className="min-h-0 flex-1 overflow-y-auto">
      {rows.map((quote) => {
        const isActive = quote.id === openId
        const status = quote.isExpired ? "Expired" : quote.status
        return (
          <a
            key={quote.id}
            ref={isActive ? activeRef : undefined}
            href={hrefFor(quote.id)}
            onClick={(event) => onOpen(event, quote.id)}
            onMouseEnter={() => prefetchQuotationDetail(quote.id)}
            onFocus={() => prefetchQuotationDetail(quote.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col gap-0.5 border-b px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
              isActive && "bg-sidebar-accent hover:bg-sidebar-accent"
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="truncate font-medium">{quote.customerName}</span>
              <span className="shrink-0 tabular-nums">{formatCurrency(quote.total)}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {quote.quoteNumber} • {formatDay(quote.quoteDate)}
            </span>
            <span className={cn("text-[11px] font-semibold uppercase", STATUS_TEXT_CLASS[status])}>
              {status}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
