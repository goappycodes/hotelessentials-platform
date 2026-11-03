import Link from "next/link"

import { Badge } from "@/components/ui/badge"
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
import { taxRoute } from "@/constants/routes"
import { TAX_SCOPE_DESCRIPTIONS, TAX_SCOPES } from "@/constants/taxes"
import { getTaxRates } from "@/features/taxes/queries"
import { formatTaxBreakdown } from "@/features/taxes/tax-rates"
import { createRequestClient } from "@/lib/supabase/server"

const COLUMNS = ["Name", "Rate", "Made up of", "Status"]

export async function TaxesTable() {
  const taxRates = await getTaxRates(await createRequestClient())

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {TAX_SCOPES.map((scope) => {
        const rows = taxRates.filter((tax) => tax.tax_scope === scope)

        return (
          <Card key={scope} className="gap-0 overflow-hidden py-0">
            <div className="border-b px-4 py-3">
              <h2 className="font-medium">{scope} taxes</h2>
              <p className="text-sm text-muted-foreground">{TAX_SCOPE_DESCRIPTIONS[scope]}</p>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No {scope.toLowerCase()} taxes yet.
              </p>
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
                  {rows.map((tax) => (
                    <TableRow key={tax.id} className="relative">
                      <TableCell className="px-4 py-3">
                        {/* The link covers the whole row. */}
                        <Link
                          href={taxRoute(tax.id)}
                          className="font-medium text-primary after:absolute after:inset-0 hover:underline"
                        >
                          {tax.name}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 tabular-nums">{tax.rate}%</TableCell>
                      <TableCell className="px-4 text-muted-foreground">
                        {formatTaxBreakdown(tax)}
                      </TableCell>
                      <TableCell className="px-4">
                        {tax.is_active ? (
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
        )
      })}
    </div>
  )
}

export function TaxesTableSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-6 xl:grid-cols-2">
      <span className="sr-only">Loading…</span>
      {TAX_SCOPES.map((scope) => (
        <Card key={scope} className="gap-0 overflow-hidden py-0">
          <div className="flex flex-col gap-2 border-b px-4 py-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-6 border-b px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="ml-auto h-5 w-16 rounded-full" />
            </div>
          ))}
        </Card>
      ))}
    </div>
  )
}
