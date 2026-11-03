import { BadgePercent } from "lucide-react"
import Link from "next/link"

import { countPriceLists } from "@/actions/price-lists"
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
import { priceListRoute } from "@/constants/routes"
import { PRICE_LISTS_LIST } from "@/features/price-lists/list-config"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { describeAdjustment } from "@/lib/price-lists"
import { createRequestClient } from "@/lib/supabase/server"

const COLUMNS = ["Name", "Description", "Transaction", "Pricing", "Status"]

export async function PriceListsTable({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>
}) {
  const [params, supabase] = await Promise.all([searchParams, createRequestClient()])
  const query = parseListQuery(params, PRICE_LISTS_LIST)

  const { data, error } = await applyListQuery(
    supabase
      .from("price_lists")
      .select(
        "id, name, description, transaction_type, price_list_type, percentage_type, percentage_value, is_active, price_list_items(count)"
      ),
    query
  )
  if (error) throw new Error("Failed to load price lists")

  const { rows, hasNextPage } = toListPage(data, query)
  const isFiltered = Object.keys(query.filters).length > 0 || query.search !== null

  return (
    <>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BadgePercent />
              </EmptyMedia>
              <EmptyTitle>{isFiltered ? "No price lists found" : "No price lists yet"}</EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No price lists match your search or filters."
                  : "Create price lists to offer different rates to different customers."}
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
              {rows.map((list) => {
                const itemCount = list.price_list_items[0]?.count ?? 0

                return (
                  <TableRow key={list.id} className="relative">
                    <TableCell className="px-4 py-3">
                      {/* The link covers the whole row, so any cell opens the price list. */}
                      <Link
                        href={priceListRoute(list.id)}
                        className="font-medium text-primary after:absolute after:inset-0 hover:underline"
                      >
                        {list.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-72 truncate px-4 text-muted-foreground">
                      {list.description ?? "—"}
                    </TableCell>
                    <TableCell className="px-4">{list.transaction_type}</TableCell>
                    <TableCell className="px-4">
                      {describeAdjustment(list.percentage_type, list.percentage_value) ??
                        `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
                    </TableCell>
                    <TableCell className="px-4">
                      {list.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <ListPagination
        config={PRICE_LISTS_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countPriceLists}
      />
    </>
  )
}

export function PriceListsTableSkeleton() {
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
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
      <ListPaginationSkeleton />
    </div>
  )
}
