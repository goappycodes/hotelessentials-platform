import { Contact } from "lucide-react"
import Link from "next/link"

import { countCustomers } from "@/actions/customers"
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
import { formatPlaceOfSupply } from "@/constants/customers"
import { customerRoute } from "@/constants/routes"
import { CUSTOMERS_LIST } from "@/features/customers/list-config"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { createRequestClient } from "@/lib/supabase/server"

const COLUMNS = ["Name", "Company Name", "Email", "Phone", "Place of Supply", "Status"]

export async function CustomersTable({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>
}) {
  const [params, supabase] = await Promise.all([searchParams, createRequestClient()])
  const query = parseListQuery(params, CUSTOMERS_LIST)

  const { data, error } = await applyListQuery(
    supabase
      .from("customers")
      .select(
        "id, display_name, company_name, email, work_phone, mobile, place_of_supply, gst_treatment, is_active"
      ),
    query
  )
  if (error) throw new Error("Failed to load customers")

  const { rows, hasNextPage } = toListPage(data, query)
  const isFiltered = Object.keys(query.filters).length > 0 || query.search !== null

  return (
    <>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Contact />
              </EmptyMedia>
              <EmptyTitle>{isFiltered ? "No customers found" : "No customers yet"}</EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No customers match your search or filters."
                  : "Add the businesses and people you sell to."}
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
              {rows.map((customer) => (
                <TableRow key={customer.id} className="relative">
                  <TableCell className="px-4 py-3">
                    {/* The link covers the whole row, so any cell opens the customer. */}
                    <Link
                      href={customerRoute(customer.id)}
                      className="font-medium text-primary after:absolute after:inset-0 hover:underline"
                    >
                      {customer.display_name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-56 truncate px-4">
                    {customer.company_name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-56 truncate px-4 text-muted-foreground">
                    {customer.email ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {customer.work_phone ?? customer.mobile ?? "—"}
                  </TableCell>
                  <TableCell className="px-4">
                    {formatPlaceOfSupply(customer.place_of_supply) ??
                      (customer.gst_treatment === "Overseas" ? "Overseas" : "—")}
                  </TableCell>
                  <TableCell className="px-4">
                    {customer.is_active ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <ListPagination
        config={CUSTOMERS_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countCustomers}
      />
    </>
  )
}

export function CustomersTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          {COLUMNS.map((column) => (
            <Skeleton key={column} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
      <ListPaginationSkeleton />
    </div>
  )
}
