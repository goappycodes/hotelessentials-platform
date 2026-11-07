"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { DashboardSalesMonth } from "@/features/dashboard/queries"
import { formatCurrency } from "@/lib/format"

// Two checked hues from the theme: they stay apart for colour-blind readers.
const CONFIG = {
  quotations: { label: "Quotations", color: "var(--chart-1)" },
  orders: { label: "Sales Orders", color: "var(--chart-2)" },
} satisfies ChartConfig

type Series = keyof typeof CONFIG

const COUNT_KEY: Record<Series, "quotationCount" | "orderCount"> = {
  quotations: "quotationCount",
  orders: "orderCount",
}

// Axis amounts the way they're said here: ₹50K, ₹2.5L, ₹1.2Cr.
function compactRupees(value: number) {
  const short = (amount: number) => String(Number(amount.toFixed(1)))
  if (value >= 10_000_000) return `₹${short(value / 10_000_000)}Cr`
  if (value >= 100_000) return `₹${short(value / 100_000)}L`
  if (value >= 1_000) return `₹${short(value / 1_000)}K`
  return `₹${value}`
}

// One ₹ value per month for each series, on a single axis. The table beneath is the same
// data for screen readers.
export function SalesChart({
  data,
  series,
}: {
  data: DashboardSalesMonth[]
  // The series this person can see, in a fixed order so colours never swap.
  series: Series[]
}) {
  return (
    <>
      <ChartContainer config={CONFIG} className="aspect-auto h-72 w-full" aria-hidden>
        <BarChart data={data} barGap={2} barCategoryGap="30%" accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
            tickFormatter={compactRupees}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel}
                formatter={(value, name, item) => {
                  const key = name as Series
                  const count = item.payload?.[COUNT_KEY[key]] ?? 0
                  return (
                    <div className="flex w-full items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: `var(--color-${key})` }}
                      />
                      <span className="text-muted-foreground">{CONFIG[key].label}</span>
                      <span className="ml-auto pl-4 font-medium tabular-nums">
                        {formatCurrency(Number(value))}
                      </span>
                      <span className="text-muted-foreground tabular-nums">({count})</span>
                    </div>
                  )
                }}
              />
            }
          />
          {/* One series is named by the card's title, so it needs no legend. */}
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              fill={`var(--color-${key})`}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>Sales by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {series.map((key) => (
              <th key={key} scope="col">
                {CONFIG[key].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((month) => (
            <tr key={month.fullLabel}>
              <th scope="row">{month.fullLabel}</th>
              {series.map((key) => (
                <td key={key}>
                  {formatCurrency(month[key])} from {month[COUNT_KEY[key]]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
