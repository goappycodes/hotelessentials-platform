"use client"

import { useEffect, useRef } from "react"

import type { DespatchRow } from "@/features/despatch/components/despatch-workspace"
import { prefetchDespatchDetail } from "@/features/despatch/despatch-detail-cache"
import { formatDay } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS_TEXT_CLASS: Record<DespatchRow["status"], string> = {
  Packed: "text-muted-foreground",
  Despatched: "text-sky-700",
  Delivered: "text-emerald-700",
}

// The narrow list beside an opened despatch: customer, number, order, date and status.
export function DespatchSideList({
  rows,
  openId,
  hrefFor,
  onOpen,
}: {
  rows: DespatchRow[]
  openId: string
  hrefFor: (despatchId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, despatchId: string) => void
}) {
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Opening a despatch far down the table: bring it into view here. Only when the list
  // first appears, so clicking within the list doesn't make it jump.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" })
  }, [])

  return (
    <nav aria-label="Despatches" className="min-h-0 flex-1 overflow-y-auto">
      {rows.map((despatch) => {
        const isActive = despatch.id === openId
        return (
          <a
            key={despatch.id}
            ref={isActive ? activeRef : undefined}
            href={hrefFor(despatch.id)}
            onClick={(event) => onOpen(event, despatch.id)}
            onMouseEnter={() => prefetchDespatchDetail(despatch.id)}
            onFocus={() => prefetchDespatchDetail(despatch.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col gap-0.5 border-b px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
              isActive && "bg-sidebar-accent hover:bg-sidebar-accent"
            )}
          >
            <span className="truncate font-medium">{despatch.customer_name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {despatch.despatch_number} • {despatch.so_number} •{" "}
              {formatDay(despatch.despatch_date)}
            </span>
            <span
              className={cn("text-[11px] font-semibold uppercase", STATUS_TEXT_CLASS[despatch.status])}
            >
              {despatch.status}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
