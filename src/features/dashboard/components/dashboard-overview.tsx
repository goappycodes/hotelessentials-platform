import { ChartColumn, CirclePlus } from "lucide-react"
import Link from "next/link"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"

const SUMMARY_CARDS = [
  {
    title: "Open Quotations",
    href: MODULE_NAV_ITEMS.quotations.create.href,
    label: "Quotations awaiting a customer response",
    emptyText: "No quotations yet",
  },
  {
    title: "Pending Sales Orders",
    href: MODULE_NAV_ITEMS.salesOrders.href,
    label: "Confirmed orders waiting for despatch",
    emptyText: "No sales orders yet",
  },
]

const SECTION_HEADER_CLASS = "border-b bg-muted/60 py-3"

export function DashboardOverview() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        {SUMMARY_CARDS.map((card) => (
          <Card key={card.title} className="gap-0 py-0">
            <CardHeader className={SECTION_HEADER_CLASS}>
              <CardTitle>{card.title}</CardTitle>
              <CardAction>
                <Link
                  href={card.href}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <CirclePlus className="size-4" />
                  New
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 py-5">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <span className="text-lg font-medium text-muted-foreground">
                {card.emptyText}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="gap-0 py-0">
        <CardHeader className={SECTION_HEADER_CLASS}>
          <CardTitle>Sales Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ChartColumn />
              </EmptyMedia>
              <EmptyTitle>No sales activity yet</EmptyTitle>
              <EmptyDescription>
                Quotation, order and despatch trends will appear here once your
                team starts recording sales.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        {SUMMARY_CARDS.map((card) => (
          <Card key={card.title} className="gap-0 py-0">
            <CardHeader className={SECTION_HEADER_CLASS}>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 py-5">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-6 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="gap-0 py-0">
        <CardHeader className={SECTION_HEADER_CLASS}>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-16">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </CardContent>
      </Card>
    </div>
  )
}
