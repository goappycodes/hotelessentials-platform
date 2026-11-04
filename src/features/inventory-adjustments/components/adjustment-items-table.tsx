"use client"

import { ChevronDown, ImageIcon, Plus, X } from "lucide-react"
import { useState } from "react"
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MAX_ADJUSTMENT_ITEMS } from "@/constants/inventory"
import type { AdjustmentItemOption } from "@/features/inventory-adjustments/queries"
import { formatQuantity, QUANTITY_PATTERN } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  ADJUSTED_QUANTITY_PATTERN,
  type InventoryAdjustmentInput,
} from "@/lib/validations/inventory-adjustment"

const HEAD_CLASS = "h-9 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"

// "+10" / "-2.5": the change between two quantities, with up to 4 decimals.
function toAdjustedText(change: number) {
  const rounded = Number(change.toFixed(4))
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

type AdjustmentItemsTableProps = {
  items: AdjustmentItemOption[]
  // Stock available for each item before this adjustment: stock on hand, minus what this
  // adjustment already added or removed when it is adjusted.
  availableFor: (itemId: string) => number
  disabled: boolean
}

// Zoho's item table: pick an item, see the quantity available, and type either the new
// quantity on hand or the quantity adjusted (+10, -10); each fills in the other.
export function AdjustmentItemsTable({ items, availableFor, disabled }: AdjustmentItemsTableProps) {
  const { control, setValue, getFieldState, formState } = useFormContext<InventoryAdjustmentInput>()
  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const lines = useWatch({ control, name: "items" })
  // The New Quantity on Hand text while it is being typed (so "2." isn't cut to "2").
  const [editingNewQuantity, setEditingNewQuantity] = useState<{ row: string; text: string }>()

  const itemsError = formState.errors.items?.root ?? formState.errors.items

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[44rem]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className={HEAD_CLASS}>Item Details</TableHead>
              <TableHead className={cn(HEAD_CLASS, "w-36 text-right")}>Quantity Available</TableHead>
              <TableHead className={cn(HEAD_CLASS, "w-40 text-right")}>New Quantity on Hand</TableHead>
              <TableHead className={cn(HEAD_CLASS, "w-40 text-right")}>Quantity Adjusted</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const line = lines?.[index] ?? field
              const item = items.find((option) => option.id === line.itemId)
              const available = item ? availableFor(item.id) : 0
              const adjusted = ADJUSTED_QUANTITY_PATTERN.test(line.quantityAdjusted.trim())
                ? Number(line.quantityAdjusted)
                : null
              const newQuantity =
                editingNewQuantity?.row === field.id
                  ? editingNewQuantity.text
                  : item && adjusted !== null
                    ? String(Number((available + adjusted).toFixed(4)))
                    : ""
              const itemError = getFieldState(`items.${index}.itemId`).error
              const quantityError = getFieldState(`items.${index}.quantityAdjusted`).error
              const takenIds = new Set(
                (lines ?? []).filter((_, other) => other !== index).map((other) => other.itemId)
              )

              return (
                <TableRow key={field.id} className="align-top hover:bg-transparent">
                  <TableCell className="px-3 py-2">
                    <ItemPicker
                      items={items.filter(
                        (option) =>
                          !takenIds.has(option.id) && (option.is_active || option.id === line.itemId)
                      )}
                      value={line.itemId}
                      selected={item}
                      invalid={Boolean(itemError)}
                      disabled={disabled}
                      onChange={(itemId) =>
                        setValue(`items.${index}.itemId`, itemId, {
                          shouldDirty: true,
                          shouldValidate: formState.isSubmitted,
                        })
                      }
                    />
                    {itemError && <FieldError className="mt-1" errors={[itemError]} />}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right tabular-nums">
                    <span className="inline-flex h-8 items-center">
                      {item ? formatQuantity(available, item.unit) : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Input
                      inputMode="decimal"
                      aria-label={`New quantity on hand, row ${index + 1}`}
                      placeholder="0.00"
                      value={newQuantity}
                      disabled={disabled || !item}
                      className="text-right tabular-nums"
                      onFocus={() => setEditingNewQuantity({ row: field.id, text: newQuantity })}
                      onBlur={() => setEditingNewQuantity(undefined)}
                      onChange={(event) => {
                        const text = event.target.value.trim()
                        setEditingNewQuantity({ row: field.id, text })
                        setValue(
                          `items.${index}.quantityAdjusted`,
                          QUANTITY_PATTERN.test(text) ? toAdjustedText(Number(text) - available) : "",
                          { shouldDirty: true, shouldValidate: formState.isSubmitted }
                        )
                      }}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Input
                      inputMode="decimal"
                      aria-label={`Quantity adjusted, row ${index + 1}`}
                      aria-invalid={Boolean(quantityError)}
                      placeholder="Eg. +10, -10"
                      value={line.quantityAdjusted}
                      disabled={disabled}
                      className="text-right tabular-nums"
                      onChange={(event) =>
                        setValue(`items.${index}.quantityAdjusted`, event.target.value.trim(), {
                          shouldDirty: true,
                          shouldValidate: formState.isSubmitted,
                        })
                      }
                    />
                    {quantityError && (
                      <FieldError className="mt-1 text-right" errors={[quantityError]} />
                    )}
                  </TableCell>
                  <TableCell className="px-1 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove row ${index + 1}`}
                      disabled={disabled || fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <X />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {itemsError?.message && <FieldError errors={[itemsError]} />}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || fields.length >= MAX_ADJUSTMENT_ITEMS}
          onClick={() => append({ itemId: "", quantityAdjusted: "" })}
        >
          <Plus />
          Add New Row
        </Button>
      </div>
    </div>
  )
}

function ItemPicker({
  items,
  value,
  selected,
  invalid,
  disabled,
  onChange,
}: {
  items: AdjustmentItemOption[]
  value: string
  selected: AdjustmentItemOption | undefined
  invalid: boolean
  disabled: boolean
  onChange: (itemId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-invalid={invalid}
          aria-label="Item"
          disabled={disabled}
          className="h-auto min-h-8 w-full justify-between py-1.5 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
              <ImageIcon className="size-3.5" />
            </span>
            {selected ? (
              <span className="min-w-0 text-left">
                <span className="block truncate font-medium">{selected.name}</span>
                {selected.sku && (
                  <span className="block truncate text-xs text-muted-foreground">
                    SKU: {selected.sku}
                  </span>
                )}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">
                Type or click to select an item.
              </span>
            )}
          </span>
          <ChevronDown
            className={cn("text-muted-foreground transition-transform", isOpen && "rotate-180")}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <Command>
          <CommandInput placeholder="Search items by name or SKU" />
          <CommandList>
            <CommandEmpty>
              No items found. Only goods with Track Inventory turned on can be adjusted.
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  // Searchable by name and SKU.
                  value={`${item.name} ${item.sku ?? ""} ${item.id}`}
                  data-checked={item.id === value}
                  onSelect={() => {
                    onChange(item.id)
                    setIsOpen(false)
                  }}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{item.name}</span>
                    {item.sku && (
                      <span className="block truncate text-xs text-muted-foreground">
                        SKU: {item.sku}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    Stock on Hand
                    <span className="block font-medium text-foreground tabular-nums">
                      {formatQuantity(item.stock_on_hand, item.unit)}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
