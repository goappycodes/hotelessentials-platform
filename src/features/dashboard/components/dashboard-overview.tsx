import { History, LayoutDashboard, PackageCheck /* , ChartColumn */ } from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
// Sales Overview is hidden for now; uncomment with the parts marked below.
// import { SalesChart } from "@/features/dashboard/components/sales-chart"
import { getDashboardData, type DashboardData } from "@/features/dashboard/queries"
import { DespatchStatusBadge } from "@/features/despatch/components/despatch-status-badge"
import { StockStatusBadge } from "@/features/inventory/components/stock-status-badge"
import { QuotationStatusBadge } from "@/features/quotations/components/quotation-status-badge"
import { SalesOrderStatusBadge } from "@/features/sales-orders/components/sales-order-status-badge"
import { formatQuantity } from "@/lib/format"
import { requireUser } from "@/lib/session"

const SECTION_HEADER_CLASS = "border-b bg-muted/60 py-3"
const ROW_CLASS = "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"

// The live picture of the business, showing only the modules this person can open.
export async function DashboardOverview() {
  const session = await requireUser()
  const data = await getDashboardData(session)
  const { can, tiles, stockAlerts, recent } = data
  // const showSales = can.quotations || can.orders // Sales Overview
  const showRecent = can.quotations || can.orders || can.despatch

  if (tiles.length === 0) {
    return (
      <Card className="gap-0 py-0">
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutDashboard />
            </EmptyMedia>
            <EmptyTitle>Nothing to show yet</EmptyTitle>
            <EmptyDescription>
              Your dashboard fills in once you have access to quotations, orders, despatch or
              inventory.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.title} href={tile.href} className="group rounded-xl">
            <Card className="h-full gap-1 p-4 transition-colors group-hover:bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground">{tile.title}</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {tile.value.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-muted-foreground">{tile.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Sales Overview is hidden for now.
      {showSales && (
        <Card className="gap-0 py-0">
          <CardHeader className={SECTION_HEADER_CLASS}>
            <CardTitle>Sales Overview, last 6 months</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <SalesOverview data={data} />
          </CardContent>
        </Card>
      )}
      */}

      {(can.stock || showRecent) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {can.stock && (
            <Card className="gap-0 py-0">
              <CardHeader className={SECTION_HEADER_CLASS}>
                <CardTitle>Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {stockAlerts.length === 0 ? (
                  <ListEmpty icon={<PackageCheck />} title="No stock alerts" />
                ) : (
                  <ul className="divide-y">
                    {stockAlerts.map((item) => (
                      <li key={item.id}>
                        <Link href={item.href} className={ROW_CLASS}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {formatQuantity(item.available_stock, item.unit)} available
                              {item.ordered_quantity > 0 &&
                                ` • ${formatQuantity(item.ordered_quantity, item.unit)} ordered`}
                            </span>
                          </span>
                          <StockStatusBadge status={item.stock_status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {showRecent && (
            <Card className="gap-0 py-0">
              <CardHeader className={SECTION_HEADER_CLASS}>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recent.length === 0 ? (
                  <ListEmpty icon={<History />} title="Nothing recorded yet" />
                ) : (
                  <ul className="divide-y">
                    {recent.map((entry) => (
                      <li key={entry.id}>
                        <Link href={entry.href} className={ROW_CLASS}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {entry.number} • {entry.customer}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {entry.kind} • {entry.date}
                            </span>
                          </span>
                          <RecentStatus entry={entry} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

/* Sales Overview is hidden for now; uncomment with the card above.
function SalesOverview({ data }: { data: DashboardData }) {
  const { can, sales } = data
  const hasSales = sales.some((month) => month.quotations > 0 || month.orders > 0)

  if (!hasSales) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartColumn />
          </EmptyMedia>
          <EmptyTitle>No sales in the last 6 months</EmptyTitle>
          <EmptyDescription>Quotations and sales orders will show here by month.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <SalesChart
      data={sales}
      series={[...(can.quotations ? ["quotations" as const] : []), ...(can.orders ? ["orders" as const] : [])]}
    />
  )
}
*/

function RecentStatus({ entry }: { entry: DashboardData["recent"][number] }) {
  if (entry.kind === "Quotation" && entry.quote) return <QuotationStatusBadge {...entry.quote} />
  if (entry.kind === "Sales Order" && entry.orderStatus) {
    return <SalesOrderStatusBadge status={entry.orderStatus} />
  }
  if (entry.kind === "Despatch" && entry.despatchStatus) {
    return <DespatchStatusBadge status={entry.despatchStatus} />
  }
  return null
}

function ListEmpty({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Empty className="py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

export function DashboardOverviewSkeleton() {
  return (
    <div aria-busy="true" className="flex w-full flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="gap-2 p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-36" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} className="gap-0 py-0">
            <CardHeader className={SECTION_HEADER_CLASS}>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-9 w-56" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
