import { Warehouse } from "lucide-react"
import Link from "next/link"

import { countInventoryAdjustments } from "@/actions/inventory-adjustments"
import {
  ListPagination,
  ListPaginationSkeleton,
} from "@/components/shared/list-pagination"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { inventoryAdjustmentRoute } from "@/constants/routes"
import { INVENTORY_ADJUSTMENTS_LIST } from "@/features/inventory-adjustments/list-config"
import { formatDay } from "@/lib/format"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { createRequestClient } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

const COLUMNS = [
  "Date",
  "Reason",
  "Description",
  "Status",
  "Reference Number",
  "Type",
  "Created By",
  "Created Time",
]

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function AdjustmentStatusBadge({ status }: { status: Enums<"adjustment_status"> }) {
  return status === "Adjusted" ? (
    <Badge className="bg-emerald-500/10 text-emerald-700">Adjusted</Badge>
  ) : (
    <Badge variant="secondary">Draft</Badge>
  )
}

export async function AdjustmentsTable({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>
}) {
  const [params, supabase] = await Promise.all([searchParams, createRequestClient()])
  const query = parseListQuery(params, INVENTORY_ADJUSTMENTS_LIST)

  const { data, error } = await applyListQuery(
    supabase
      .from("inventory_adjustments")
      .select(
        "id, adjustment_date, reason, description, status, reference_number, mode, created_at, created_by:profiles(first_name, last_name)"
      ),
    query
  )
  if (error) throw new Error("Failed to load inventory adjustments")

  const { rows, hasNextPage } = toListPage(data, query)
  const isFiltered = Object.keys(query.filters).length > 0 || query.search !== null

  return (
    <>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Warehouse />
              </EmptyMedia>
              <EmptyTitle>
                {isFiltered ? "No adjustments found" : "No inventory adjustments yet"}
              </EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No adjustments match your search or filters."
                  : "Record stock you add or remove, like a stock count or damaged goods."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column}
                    className="h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((adjustment) => (
                <TableRow key={adjustment.id} className="relative">
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    {/* The link covers the whole row, so any cell opens the adjustment. */}
                    <Link
                      href={inventoryAdjustmentRoute(adjustment.id)}
                      className="font-medium text-primary after:absolute after:inset-0 hover:underline"
                    >
                      {formatDay(adjustment.adjustment_date)}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4">{adjustment.reason}</TableCell>
                  <TableCell className="max-w-64 truncate px-4 text-muted-foreground">
                    {adjustment.description ?? "—"}
                  </TableCell>
                  <TableCell className="px-4">
                    <AdjustmentStatusBadge status={adjustment.status} />
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {adjustment.reference_number ?? "—"}
                  </TableCell>
                  <TableCell className="px-4">
                    {adjustment.mode === "Quantity Adjustment" ? "Quantity" : "Value"}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {adjustment.created_by
                      ? [adjustment.created_by.first_name, adjustment.created_by.last_name]
                          .filter(Boolean)
                          .join(" ")
                      : "—"}
                  </TableCell>
                  <TableCell className="px-4 whitespace-nowrap text-muted-foreground">
                    {dateTimeFormat.format(new Date(adjustment.created_at))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <ListPagination
        config={INVENTORY_ADJUSTMENTS_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countInventoryAdjustments}
      />
    </>
  )
}

export function AdjustmentsTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          {COLUMNS.map((column) => (
            <Skeleton key={column} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-4 w-28" />
          </div>
        ))}
      </Card>
      <ListPaginationSkeleton />
    </div>
  )
}
