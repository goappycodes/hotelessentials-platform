"use client"

import { Contact } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import { countCustomers } from "@/actions/customers"
import { ListFilterMenu } from "@/components/shared/list-filter-menu"
import { ListPagination } from "@/components/shared/list-pagination"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { customerRoute } from "@/constants/routes"
import { CustomersBulkActions } from "@/features/customers/components/customers-bulk-actions"
import {
  CUSTOMER_COLUMNS,
  CUSTOMER_STATUS_FILTER_OPTIONS,
  CUSTOMER_TYPE_FILTER_OPTIONS,
  CUSTOMERS_LIST,
} from "@/features/customers/list-config"

export type CustomerRow = {
  id: string
  displayName: string
  companyName: string | null
  email: string | null
  phone: string | null
  placeOfSupply: string | null
  isActive: boolean
}

type CustomersListProps = {
  rows: CustomerRow[]
  hasNextPage: boolean
  isFiltered: boolean
  // Bulk actions on customers picked with the checkboxes.
  canEdit: boolean
  canDelete: boolean
}

// The customers list with checkboxes. With customers checked, Zoho's bulk actions bar
// takes the place of the filters.
export function CustomersList({
  rows,
  hasNextPage,
  isFiltered,
  canEdit,
  canDelete,
}: CustomersListProps) {
  const router = useRouter()
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  // Only customers on this page count, so changing page, filters or search drops the rest.
  const selectedIds = checkedIds.filter((id) => rows.some((row) => row.id === id))
  const canSelect = canEdit || canDelete
  const allSelected = rows.length > 0 && selectedIds.length === rows.length

  const clearSelection = useCallback(() => setCheckedIds([]), [])
  const refreshList = useCallback(() => router.refresh(), [router])

  function toggle(id: string, checked: boolean) {
    setCheckedIds((ids) => (checked ? [...ids, id] : ids.filter((other) => other !== id)))
  }

  return (
    <>
      {selectedIds.length > 0 ? (
        <CustomersBulkActions
          selectedIds={selectedIds}
          canEdit={canEdit}
          canDelete={canDelete}
          onClear={clearSelection}
          onChanged={refreshList}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <ListFilterMenu
            config={CUSTOMERS_LIST}
            filterKey="customer_type"
            label="Type"
            options={CUSTOMER_TYPE_FILTER_OPTIONS}
          />
          <ListFilterMenu
            config={CUSTOMERS_LIST}
            filterKey="is_active"
            label="Status"
            options={CUSTOMER_STATUS_FILTER_OPTIONS}
          />
        </div>
      )}
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
                {canSelect && (
                  <TableHead className="w-10 pr-0 pl-4">
                    <Checkbox
                      aria-label="Select all customers on this page"
                      checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false}
                      onCheckedChange={(checked) =>
                        setCheckedIds(checked === true ? rows.map((row) => row.id) : [])
                      }
                    />
                  </TableHead>
                )}
                {CUSTOMER_COLUMNS.map((column) => (
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
              {rows.map((customer) => {
                const isSelected = selectedIds.includes(customer.id)
                return (
                  <TableRow
                    key={customer.id}
                    className="relative"
                    data-state={isSelected ? "selected" : undefined}
                  >
                    {canSelect && (
                      // Just above the row-wide link, so ticking doesn't open the customer,
                      // but below the sticky header and its search dropdown.
                      <TableCell className="relative z-[1] w-10 pr-0 pl-4">
                        <Checkbox
                          aria-label={`Select ${customer.displayName}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => toggle(customer.id, checked === true)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-3">
                      {/* The link covers the whole row, so any cell opens the customer. */}
                      <Link
                        href={customerRoute(customer.id)}
                        className="font-medium text-primary after:absolute after:inset-0 hover:underline"
                      >
                        {customer.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-56 truncate px-4">
                      {customer.companyName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-56 truncate px-4 text-muted-foreground">
                      {customer.email ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {customer.phone ?? "—"}
                    </TableCell>
                    <TableCell className="px-4">{customer.placeOfSupply ?? "—"}</TableCell>
                    <TableCell className="px-4">
                      {customer.isActive ? (
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
        config={CUSTOMERS_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countCustomers}
      />
    </>
  )
}
