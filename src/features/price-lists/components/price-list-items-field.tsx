"use client"

import { Search } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TransactionType } from "@/constants/price-lists"
import type { PriceListItemOption } from "@/features/price-lists/queries"
import { formatCurrency } from "@/lib/format"

type PriceListItemsFieldProps = {
  items: PriceListItemOption[]
  transactionType: TransactionType
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  disabled?: boolean
}

// Custom rate per item. Lists items that can be sold (or bought, for purchase lists),
// plus any item that already has a rate here.
export function PriceListItemsField({
  items,
  transactionType,
  value,
  onChange,
  disabled,
}: PriceListItemsFieldProps) {
  const [filter, setFilter] = useState("")
  const isSales = transactionType === "Sales"
  const term = filter.trim().toLowerCase()

  const rows = items.filter((item) => {
    const hasRate = Boolean(value[item.id])
    const available = item.is_active && (isSales ? item.sales_enabled : item.purchase_enabled)
    const matches =
      !term || item.name.toLowerCase().includes(term) || item.sku?.toLowerCase().includes(term)
    return (available || hasRate) && matches
  })
  const ratedCount = Object.values(value).filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter items by name or SKU"
            aria-label="Filter items"
          />
        </InputGroup>
        <p className="text-sm text-muted-foreground">
          {ratedCount} {ratedCount === 1 ? "item has" : "items have"} a custom rate
        </p>
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Item
              </TableHead>
              <TableHead className="px-4 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {isSales ? "Sales rate" : "Purchase rate"}
              </TableHead>
              <TableHead className="w-44 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Custom rate
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  {items.length === 0
                    ? "No items yet. Add items first, then give them custom rates here."
                    : "No items match."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="px-4 py-2">
                    <p className="flex items-center gap-2 font-medium">
                      {item.name}
                      {!item.is_active && <Badge variant="destructive">Inactive</Badge>}
                    </p>
                    {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                  </TableCell>
                  <TableCell className="px-4 text-right text-muted-foreground tabular-nums">
                    {formatCurrency(isSales ? item.selling_price : item.cost_price)}
                    {item.unit && <span className="text-xs"> / {item.unit}</span>}
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>₹</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        inputMode="decimal"
                        value={value[item.id] ?? ""}
                        disabled={disabled}
                        onChange={(event) =>
                          onChange({ ...value, [item.id]: event.target.value.trim() })
                        }
                        aria-label={`Custom rate for ${item.name}`}
                        className="tabular-nums"
                      />
                    </InputGroup>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
