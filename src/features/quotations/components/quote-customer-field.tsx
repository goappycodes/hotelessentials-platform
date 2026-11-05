"use client"

import { ChevronDown } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useController, useFormContext } from "react-hook-form"

import { searchQuoteCustomers, type QuoteCustomerPage } from "@/actions/quotations"
import {
  FormFieldLabel,
  HORIZONTAL_FIELD_CLASS,
} from "@/components/shared/form-field-label"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import type { QuoteCustomer } from "@/features/quotations/queries"
import { cn } from "@/lib/utils"
import type { QuotationInput } from "@/lib/validations/quotation"

const SEARCH_DEBOUNCE_MS = 200

export const customerLabel = (customer: QuoteCustomer) =>
  customer.company_name && customer.company_name !== customer.display_name
    ? `${customer.display_name} (${customer.company_name})`
    : customer.display_name

// The quotation's customer: a box you type straight into. Customers are searched on the
// server (the list can be long, so they aren't all loaded with the page); more come in as
// the list is scrolled.
export function QuoteCustomerField({
  selected,
  onSelectedChange,
  disabled,
}: {
  selected: QuoteCustomer | null
  onSelectedChange: (customer: QuoteCustomer | null) => void
  disabled: boolean
}) {
  const { control } = useFormContext<QuotationInput>()
  const { field, fieldState } = useController({ control, name: "customerId" })
  const selectedId = field.value
  const listboxId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  // What's typed; null shows the chosen customer.
  const [query, setQuery] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [results, setResults] = useState<({ term: string } & QuoteCustomerPage) | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const term = (query ?? "").trim()

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const page = await searchQuoteCustomers(term)
      if (!cancelled) setResults({ term, ...page })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, term])

  const isCurrent = results?.term === term
  // Only results for what's in the box now, so Enter never picks from an older search.
  const customers = isCurrent ? results.customers : []
  const isSearching = isOpen && !isCurrent

  function close() {
    setIsOpen(false)
    setQuery(null)
    setActiveIndex(-1)
  }

  function choose(customer: QuoteCustomer) {
    onSelectedChange(customer)
    field.onChange(customer.id)
    close()
  }

  async function loadMore() {
    if (!results || !isCurrent || !results.hasMore || isLoadingMore) return
    setIsLoadingMore(true)
    const page = await searchQuoteCustomers(term, results.customers.length)
    setIsLoadingMore(false)
    setResults((current) => {
      // Something else was typed meanwhile: that search's results stand.
      if (current?.term !== term) return current
      const seen = new Set(current.customers.map((customer) => customer.id))
      return {
        ...current,
        customers: [
          ...current.customers,
          ...page.customers.filter((customer) => !seen.has(customer.id)),
        ],
        hasMore: page.hasMore,
      }
    })
  }

  // Arrow keys: move the highlight, keep it in view, and fetch more at the end.
  function moveActive(step: 1 | -1) {
    if (!customers.length) return
    const next = (activeIndex + step + customers.length) % customers.length
    setActiveIndex(next)
    document.getElementById(`${listboxId}-${next}`)?.scrollIntoView({ block: "nearest" })
    if (next >= customers.length - 2) void loadMore()
  }

  return (
    <Field data-invalid={fieldState.invalid} className={HORIZONTAL_FIELD_CLASS}>
      <FormFieldLabel htmlFor={field.name} label="Customer Name" required />
      <Popover open={isOpen} onOpenChange={(open) => !open && close()}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative">
            <Input
              id={field.name}
              value={query ?? (selected ? customerLabel(selected) : "")}
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                isOpen && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
              }
              aria-invalid={fieldState.invalid}
              aria-required
              autoComplete="off"
              placeholder="Type or click to select a customer"
              disabled={disabled}
              className="pr-8"
              onFocus={(event) => {
                event.currentTarget.select()
                setIsOpen(true)
              }}
              onClick={() => setIsOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value)
                setIsOpen(true)
                setActiveIndex(0)
              }}
              onBlur={() => {
                // Emptying the box clears the choice; otherwise keep it.
                if (query !== null && query.trim() === "") {
                  onSelectedChange(null)
                  field.onChange("")
                }
                field.onBlur()
                close()
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault()
                  setIsOpen(true)
                  moveActive(event.key === "ArrowDown" ? 1 : -1)
                } else if (event.key === "Enter" && isOpen) {
                  // Keep Enter from submitting the form while choosing.
                  event.preventDefault()
                  if (customers[activeIndex]) choose(customers[activeIndex])
                } else if (event.key === "Escape" && isOpen) {
                  event.preventDefault()
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
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-72 p-1"
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
            aria-label="Customers"
            aria-busy={isLoadingMore || undefined}
            className="max-h-72 overflow-y-auto"
            // Near the bottom: the next batch.
            onScroll={(event) => {
              const list = event.currentTarget
              if (list.scrollTop + list.clientHeight >= list.scrollHeight - 48) void loadMore()
            }}
          >
            {customers.length === 0 ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                {isSearching ? "Searching…" : term ? "No customers match." : "No customers yet."}
              </li>
            ) : (
              customers.map((customer, index) => (
                <li
                  key={customer.id}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={customer.id === selectedId}
                  // Keep focus in the box, so the click picks before the list closes.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(customer)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "cursor-default truncate rounded-sm px-2 py-1.5 text-sm",
                    index === activeIndex && "bg-accent text-accent-foreground",
                    customer.id === selectedId && "font-medium"
                  )}
                >
                  {customerLabel(customer)}
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
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )
}
