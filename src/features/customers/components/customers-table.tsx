import { ListPaginationSkeleton } from "@/components/shared/list-pagination"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPlaceOfSupply } from "@/constants/customers"
import { CustomersList, type CustomerRow } from "@/features/customers/components/customers-list"
import { CUSTOMER_COLUMNS, CUSTOMERS_LIST } from "@/features/customers/list-config"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

// One page of customers (sort, filters, search and page from the URL), shown with
// checkboxes for bulk actions by CustomersList.
export async function CustomersTable({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>
}) {
  const [params, supabase, session] = await Promise.all([
    searchParams,
    createRequestClient(),
    requireUser(),
  ])
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

  return (
    <CustomersList
      rows={rows.map(
        (customer): CustomerRow => ({
          id: customer.id,
          displayName: customer.display_name,
          companyName: customer.company_name,
          email: customer.email,
          phone: customer.work_phone ?? customer.mobile,
          placeOfSupply:
            formatPlaceOfSupply(customer.place_of_supply) ??
            (customer.gst_treatment === "Overseas" ? "Overseas" : null),
          isActive: customer.is_active,
        })
      )}
      hasNextPage={hasNextPage}
      isFiltered={Object.keys(query.filters).length > 0 || query.search !== null}
      canEdit={hasAccess(session, "customers", "edit")}
      canDelete={hasAccess(session, "customers", "delete")}
    />
  )
}

export function CustomersTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          <Skeleton className="size-4 rounded-sm" />
          {CUSTOMER_COLUMNS.map((column) => (
            <Skeleton key={column} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-4 py-3">
            <Skeleton className="size-4 rounded-sm" />
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
