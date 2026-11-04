"use client"

import { ChevronDown, Plus, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useFieldArray, useFormContext, useWatch, type FieldPath } from "react-hook-form"

import {
  searchQuoteItems,
  type QuoteItemOption,
  type QuoteItemPage,
} from "@/actions/quotations"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EMPTY_LINE } from "@/features/quotations/quotation-input"
import { formatTaxName, type TaxRate } from "@/features/taxes/tax-rates"
import { formatCurrency, toMoneyInput } from "@/lib/format"
import { defaultTaxIdFor } from "@/lib/quotations"
import { cn } from "@/lib/utils"
import {
  MAX_QUOTATION_LINES,
  type QuotationInput,
  type QuotationLineInput,
} from "@/lib/validations/quotation"

const HEAD_CLASS = "h-9 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
// Radix Select can't hold an empty value, so this stands in for "no tax".
const NO_TAX = "__none__"
const SEARCH_DEBOUNCE_MS = 200

type QuotationItemsTableProps = {
  taxes: readonly TaxRate[]
  // Each line's amount after its discount (from the totals), for the Amount column.
  lineAmounts: number[]
  businessState: string | null
  // The customer is overseas (exports): items get no GST by default.
  isOverseas: boolean
  disabled: boolean
  // Under the table, like Zoho: customer notes beside "Add New Row", totals on the right.
  notes: React.ReactNode
  totals: React.ReactNode
}

// Zoho's item table: pick an item (searched on the server as you type) or type a name,
// then quantity, rate, discount (at line level) and tax.
export function QuotationItemsTable({
  taxes,
  lineAmounts,
  businessState,
  isOverseas,
  disabled,
  notes,
  totals,
}: QuotationItemsTableProps) {
  const { control, register, setValue, getValues, getFieldState, formState } =
    useFormContext<QuotationInput>()
  const { fields, append, remove } = useFieldArray({ control, name: "lines" })
  const [discountLevel, priceListId] = useWatch({
    control,
    name: ["discountLevel", "priceListId"],
  })
  const isLineLevel = discountLevel === "Line Item"
  const linesError = formState.errors.lines?.root ?? formState.errors.lines

  const set = (name: FieldPath<QuotationInput>, value: string | boolean) =>
    setValue(name, value as never, { shouldDirty: true, shouldValidate: formState.isSubmitted })

  function chooseItem(index: number, item: QuoteItemOption) {
    const placeOfSupply = getValues("placeOfSupply") || null
    const taxId = item.isTaxable
      ? defaultTaxIdFor(
          { intraTaxId: item.intraTaxId, interTaxId: item.interTaxId },
          placeOfSupply,
          businessState,
          isOverseas
        )
      : null
    set(`lines.${index}.itemId`, item.id)
    set(`lines.${index}.name`, item.name)
    // Lines carry no description (only the item's name).
    set(`lines.${index}.description`, "")
    set(`lines.${index}.hsnCode`, item.hsnCode ?? "")
    set(`lines.${index}.unit`, item.unit ?? "")
    set(`lines.${index}.rate`, toMoneyInput(item.rate))
    set(`lines.${index}.taxId`, taxId ?? "")
    set(`lines.${index}.itemIntraTaxId`, item.isTaxable ? (item.intraTaxId ?? "") : "")
    set(`lines.${index}.itemInterTaxId`, item.isTaxable ? (item.interTaxId ?? "") : "")
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <div className="border-b bg-muted/40 px-3 py-2.5">
          <h3 className="text-sm font-semibold">Item Table</h3>
        </div>
        <Table className="min-w-[58rem] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD_CLASS}>Item Details</TableHead>
              <TableHead className={cn(HEAD_CLASS, "w-24 text-right")}>Quantity</TableHead>
              <TableHead className={cn(HEAD_CLASS, "w-32 text-right")}>Rate</TableHead>
              {isLineLevel && (
                <TableHead className={cn(HEAD_CLASS, "w-36 text-right")}>Discount</TableHead>
              )}
              <TableHead className={cn(HEAD_CLASS, "w-44")}>Tax</TableHead>
              <TableHead className={cn(HEAD_CLASS, "w-32 text-right")}>Amount</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const error = (name: keyof QuotationLineInput) =>
                getFieldState(`lines.${index}.${name}`, formState).error
              return (
                <LineRow
                  key={field.id}
                  index={index}
                  taxes={taxes}
                  amount={lineAmounts[index] ?? 0}
                  isLineLevel={isLineLevel}
                  priceListId={priceListId}
                  disabled={disabled}
                  canRemove={fields.length > 1}
                  onRemove={() => remove(index)}
                  onChooseItem={(item) => chooseItem(index, item)}
                  onTypeName={(name) => {
                    // A typed name is a line of its own, not tied to an item.
                    set(`lines.${index}.itemId`, "")
                    set(`lines.${index}.itemIntraTaxId`, "")
                    set(`lines.${index}.itemInterTaxId`, "")
                    set(`lines.${index}.hsnCode`, "")
                    set(`lines.${index}.name`, name)
                  }}
                  register={register}
                  set={set}
                  errors={{
                    name: error("name"),
                    quantity: error("quantity"),
                    rate: error("rate"),
                    discountValue: error("discountValue"),
                  }}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>
      {linesError?.message && <FieldError errors={[linesError]} />}
      <div className="grid gap-6 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        <div className="flex flex-col gap-6">
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || fields.length >= MAX_QUOTATION_LINES}
              onClick={() => append({ ...EMPTY_LINE })}
            >
              <Plus />
              Add New Row
            </Button>
          </div>
          <div className="mt-auto">{notes}</div>
        </div>
        {totals}
      </div>
    </div>
  )
}

type LineError = { message?: string } | undefined

function LineRow({
  index,
  taxes,
  amount,
  isLineLevel,
  priceListId,
  disabled,
  canRemove,
  onRemove,
  onChooseItem,
  onTypeName,
  register,
  set,
  errors,
}: {
  index: number
  taxes: readonly TaxRate[]
  amount: number
  isLineLevel: boolean
  priceListId: string
  disabled: boolean
  canRemove: boolean
  onRemove: () => void
  onChooseItem: (item: QuoteItemOption) => void
  onTypeName: (name: string) => void
  register: ReturnType<typeof useFormContext<QuotationInput>>["register"]
  set: (name: FieldPath<QuotationInput>, value: string | boolean) => void
  errors: Record<"name" | "quantity" | "rate" | "discountValue", LineError>
}) {
  const { control } = useFormContext<QuotationInput>()
  const line = useWatch({ control, name: `lines.${index}` })

  // Inactive taxes stay listed only for lines that already use them.
  const taxOptions = taxes.filter((tax) => tax.is_active || tax.id === line.taxId)

  return (
    <TableRow className="align-top hover:bg-transparent">
      <TableCell className="px-2 py-2">
        <ItemInput
          index={index}
          name={line.name}
          hsnCode={line.itemId ? line.hsnCode : ""}
          priceListId={priceListId}
          invalid={Boolean(errors.name)}
          disabled={disabled}
          onChoose={onChooseItem}
          onTypeName={onTypeName}
        />
        {errors.name && <FieldError className="mt-1" errors={[errors.name]} />}
      </TableCell>
      <TableCell className="px-2 py-2">
        <Input
          {...register(`lines.${index}.quantity`)}
          inputMode="decimal"
          aria-label={`Quantity, row ${index + 1}`}
          aria-invalid={Boolean(errors.quantity)}
          disabled={disabled}
          className="text-right tabular-nums"
        />
        {line.unit && <p className="mt-1 text-right text-xs text-muted-foreground">{line.unit}</p>}
        {errors.quantity && <FieldError className="mt-1 text-right" errors={[errors.quantity]} />}
      </TableCell>
      <TableCell className="px-2 py-2">
        <Input
          {...register(`lines.${index}.rate`)}
          inputMode="decimal"
          aria-label={`Rate, row ${index + 1}`}
          aria-invalid={Boolean(errors.rate)}
          disabled={disabled}
          className="text-right tabular-nums"
        />
        {errors.rate && <FieldError className="mt-1 text-right" errors={[errors.rate]} />}
      </TableCell>
      {isLineLevel && (
        <TableCell className="px-2 py-2">
          <div className="flex">
            <Input
              {...register(`lines.${index}.discountValue`)}
              inputMode="decimal"
              placeholder="0"
              aria-label={`Discount, row ${index + 1}`}
              aria-invalid={Boolean(errors.discountValue)}
              disabled={disabled}
              className="min-w-0 rounded-r-none text-right tabular-nums"
            />
            <PercentOrAmount
              isPercent={line.discountIsPercent}
              disabled={disabled}
              label={`Discount type, row ${index + 1}`}
              onChange={(isPercent) => set(`lines.${index}.discountIsPercent`, isPercent)}
            />
          </div>
          {errors.discountValue && (
            <FieldError className="mt-1 text-right" errors={[errors.discountValue]} />
          )}
        </TableCell>
      )}
      <TableCell className="px-2 py-2">
        <Select
          value={line.taxId || NO_TAX}
          onValueChange={(value) => set(`lines.${index}.taxId`, value === NO_TAX ? "" : value)}
          disabled={disabled}
        >
          <SelectTrigger aria-label={`Tax, row ${index + 1}`} className="w-full">
            <SelectValue placeholder="Select a tax" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TAX}>No tax</SelectItem>
            {taxOptions.map((tax) => (
              <SelectItem key={tax.id} value={tax.id}>
                {formatTaxName(tax)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-medium tabular-nums">
        <span className="inline-flex h-8 items-center">{formatCurrency(amount)}</span>
      </TableCell>
      <TableCell className="px-1 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove row ${index + 1}`}
          disabled={disabled || !canRemove}
          onClick={onRemove}
        >
          <X />
        </Button>
      </TableCell>
    </TableRow>
  )
}

// "%" or "₹" next to a discount box.
export function PercentOrAmount({
  isPercent,
  onChange,
  disabled,
  label,
}: {
  isPercent: boolean
  onChange: (isPercent: boolean) => void
  disabled: boolean
  label: string
}) {
  return (
    <Select value={isPercent ? "%" : "₹"} onValueChange={(value) => onChange(value === "%")} disabled={disabled}>
      <SelectTrigger aria-label={label} className="w-14 shrink-0 rounded-l-none border-l-0 px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="%">%</SelectItem>
        <SelectItem value="₹">₹</SelectItem>
      </SelectContent>
    </Select>
  )
}

// The item cell, like Zoho's: a text box you type straight into. Matching items (searched
// on the server, so all items are reachable) drop down underneath; pick one to fill the
// line, or keep what you typed as a line of its own.
function ItemInput({
  index,
  name,
  hsnCode,
  priceListId,
  invalid,
  disabled,
  onChoose,
  onTypeName,
}: {
  index: number
  name: string
  // Shown under the box for a line from an item.
  hsnCode: string
  priceListId: string
  invalid: boolean
  disabled: boolean
  onChoose: (item: QuoteItemOption) => void
  onTypeName: (name: string) => void
}) {
  const listboxId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [results, setResults] = useState<
    ({ term: string; priceListId: string } & QuoteItemPage) | null
  >(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const term = name.trim()

  // The first batch for what's typed; more come in as the list is scrolled.
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const page = await searchQuoteItems(term, priceListId)
      if (!cancelled) setResults({ term, priceListId, ...page })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, term, priceListId])

  const isCurrent = results?.term === term && results.priceListId === priceListId
  // Only results for what's in the box now, so Enter never picks from an older search.
  const items = isCurrent ? results.items : []
  const isSearching = isOpen && !isCurrent

  async function loadMore() {
    if (!results || !isCurrent || !results.hasMore || isLoadingMore) return
    setIsLoadingMore(true)
    const page = await searchQuoteItems(term, priceListId, results.items.length)
    setIsLoadingMore(false)
    setResults((current) => {
      // Something else was typed meanwhile: that search's results stand.
      if (!current || current.term !== term || current.priceListId !== priceListId) return current
      const seen = new Set(current.items.map((item) => item.id))
      return {
        ...current,
        items: [...current.items, ...page.items.filter((item) => !seen.has(item.id))],
        hasMore: page.hasMore,
      }
    })
  }

  // Arrow keys: move the highlight, keep it in view, and fetch more at the end.
  function moveActive(step: 1 | -1) {
    if (!items.length) return
    const next = (activeIndex + step + items.length) % items.length
    setActiveIndex(next)
    document.getElementById(`${listboxId}-${next}`)?.scrollIntoView({ block: "nearest" })
    if (next >= items.length - 2) void loadMore()
  }

  function close() {
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function choose(item: QuoteItemOption) {
    onChoose(item)
    close()
  }

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && close()}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative">
          <Input
            value={name}
            role="combobox"
            aria-label={`Item, row ${index + 1}`}
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              isOpen && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
            }
            aria-invalid={invalid}
            autoComplete="off"
            maxLength={200}
            placeholder="Type or click to select an item."
            disabled={disabled}
            className="pr-8"
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onChange={(event) => {
              // Typing makes it a line of its own until an item is picked.
              onTypeName(event.target.value)
              setIsOpen(true)
              setActiveIndex(-1)
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                setIsOpen(true)
                moveActive(event.key === "ArrowDown" ? 1 : -1)
              } else if (event.key === "Enter" && isOpen && activeIndex >= 0 && items[activeIndex]) {
                event.preventDefault()
                choose(items[activeIndex])
              } else if (event.key === "Escape" || event.key === "Tab") {
                close()
              }
            }}
          />
          {isSearching ? (
            <Spinner className="pointer-events-none absolute top-2 right-2.5 size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="pointer-events-none absolute top-2 right-2.5 size-4 text-muted-foreground" />
          )}
        </div>
      </PopoverAnchor>
      {/* {hsnCode && <p className="mt-1 truncate text-xs text-muted-foreground">HSN: {hsnCode}</p>} */}
      <PopoverContent
        align="start"
        className="w-[28rem] max-w-[calc(100vw-2rem)] p-1"
        // Typing stays in the box while the list is open.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Clicking back into the box keeps the list open.
        onInteractOutside={(event) => {
          if (event.target instanceof Node && anchorRef.current?.contains(event.target)) {
            event.preventDefault()
          }
        }}
      >
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Items"
          aria-busy={isLoadingMore || undefined}
          className="max-h-72 overflow-y-auto"
          // Near the bottom: the next batch.
          onScroll={(event) => {
            const list = event.currentTarget
            if (list.scrollTop + list.clientHeight >= list.scrollHeight - 48) void loadMore()
          }}
        >
          {items.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">
              {isSearching
                ? "Searching…"
                : term
                  ? `No items match. “${term}” is used as typed.`
                  : "No items."}
            </li>
          ) : (
            items.map((item, itemIndex) => (
              <li
                key={item.id}
                id={`${listboxId}-${itemIndex}`}
                role="option"
                aria-selected={itemIndex === activeIndex}
                // Keep focus in the box, so the click picks before the list closes.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                onMouseEnter={() => setActiveIndex(itemIndex)}
                className={cn(
                  "flex cursor-default items-start justify-between gap-3 rounded-sm px-2 py-1.5 text-sm",
                  itemIndex === activeIndex && "bg-accent text-accent-foreground"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[item.sku && `SKU: ${item.sku}`, item.hsnCode && `HSN: ${item.hsnCode}`]
                      .filter(Boolean)
                      .join(" · ") || " "}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums">
                  {formatCurrency(item.rate)}
                  {item.unit && <span className="text-muted-foreground"> / {item.unit}</span>}
                </span>
              </li>
            ))
          )}
          {isCurrent && results.hasMore && (
            <li className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              {isLoadingMore ? (
                <>
                  <Spinner className="size-3.5" /> Loading more…
                </>
              ) : (
                "Scroll for more"
              )}
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
