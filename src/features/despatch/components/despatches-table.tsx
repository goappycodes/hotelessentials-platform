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
import { DespatchStatusBadge } from "@/features/despatch/components/despatch-status-badge"
import type { DespatchRow } from "@/features/despatch/components/despatch-workspace"
import { prefetchDespatchDetail } from "@/features/despatch/despatch-detail-cache"
import { DESPATCH_COLUMNS } from "@/features/despatch/list-config"
import { formatDay } from "@/lib/format"

const HEAD_CLASS = "h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"

// The full despatch list. A row opens the despatch beside the list.
export function DespatchesTable({
  rows,
  hrefFor,
  onOpen,
}: {
  rows: DespatchRow[]
  hrefFor: (despatchId: string) => string
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, despatchId: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          {DESPATCH_COLUMNS.map((column) => (
            <TableHead key={column} className={HEAD_CLASS}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((despatch) => (
          <TableRow key={despatch.id} className="relative">
            <TableCell className="px-4 py-3 whitespace-nowrap">
              {formatDay(despatch.despatch_date)}
            </TableCell>
            <TableCell className="px-4">
              {/* The link covers the whole row, so any cell opens the despatch. */}
              <a
                href={hrefFor(despatch.id)}
                onClick={(event) => onOpen(event, despatch.id)}
                onMouseEnter={() => prefetchDespatchDetail(despatch.id)}
                onFocus={() => prefetchDespatchDetail(despatch.id)}
                className="font-medium text-primary after:absolute after:inset-0 hover:underline"
              >
                {despatch.despatch_number}
              </a>
            </TableCell>
            <TableCell className="px-4 text-muted-foreground">{despatch.so_number}</TableCell>
            <TableCell className="max-w-64 truncate px-4">{despatch.customer_name}</TableCell>
            <TableCell className="px-4 text-muted-foreground">
              {despatch.transporter ?? "—"}
            </TableCell>
            <TableCell className="px-4 text-muted-foreground">
              {despatch.tracking_number ?? "—"}
            </TableCell>
            <TableCell className="px-4">
              <DespatchStatusBadge status={despatch.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function DespatchesTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          {DESPATCH_COLUMNS.map((column) => (
            <Skeleton key={column} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  )
}
