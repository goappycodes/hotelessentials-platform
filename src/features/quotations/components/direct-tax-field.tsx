"use client"

import { ChevronDown, CirclePlus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"

import type { DirectTaxRate } from "@/actions/direct-taxes"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ROUTES } from "@/constants/routes"
import { DirectTaxDialog } from "@/features/direct-taxes/components/direct-tax-dialog"
import { cn } from "@/lib/utils"
import type { QuotationInput } from "@/lib/validations/quotation"

const numberFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatDirectTax = (rate: Pick<DirectTaxRate, "name" | "rate">) =>
  `${rate.name} [${Number(rate.rate.toFixed(2))}%]`

// Zoho's TDS / TCS row under the sub total: pick which, then a rate from a searchable
// list (or add one). TDS comes off the total; TCS is added.
export function DirectTaxField({
  rates,
  amount,
  canManage,
  disabled,
  onRateAdded,
}: {
  rates: readonly DirectTaxRate[]
  // What the picked rate comes to.
  amount: number
  // Owners and admins can add a rate from here.
  canManage: boolean
  disabled: boolean
  onRateAdded: (rate: DirectTaxRate) => void
}) {
  const { control, setValue } = useFormContext<QuotationInput>()
  const [kind, directTaxId] = useWatch({ control, name: ["taxDeductionType", "directTaxId"] })
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  const selected = rates.find((rate) => rate.id === directTaxId)
  // Inactive rates stay listed only when this quotation already uses one.
  const options = rates.filter(
    (rate) => rate.kind === kind && (rate.is_active || rate.id === directTaxId)
  )

  function pick(id: string) {
    setValue("directTaxId", id, { shouldDirty: true })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <RadioGroup
        value={kind}
        onValueChange={(value) => {
          setValue("taxDeductionType", value as QuotationInput["taxDeductionType"], {
            shouldDirty: true,
          })
          // A TDS rate doesn't apply to TCS and the other way round.
          pick("")
        }}
        disabled={disabled}
        aria-label="TDS or TCS"
        className="flex w-auto gap-4"
      >
        {(["TDS", "TCS"] as const).map((option) => (
          <div key={option} className="flex items-center gap-1.5">
            <RadioGroupItem value={option} id={`direct-tax-${option}`} />
            <Label htmlFor={`direct-tax-${option}`} className="font-normal">
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            aria-label={`${kind} rate`}
            disabled={disabled}
            className="h-8 w-52 justify-between bg-background font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? formatDirectTax(selected) : "Select a Tax"}
            </span>
            <ChevronDown className={cn("text-muted-foreground transition-transform", isOpen && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Search" />
            <CommandList className="max-h-56">
              <CommandEmpty className="py-3 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
                No results found
              </CommandEmpty>
              {selected && (
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      pick("")
                      setIsOpen(false)
                    }}
                    className="text-muted-foreground"
                  >
                    None
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {options.map((rate) => (
                  <CommandItem
                    key={rate.id}
                    value={formatDirectTax(rate)}
                    data-checked={rate.id === directTaxId}
                    onSelect={() => {
                      pick(rate.id)
                      setIsOpen(false)
                    }}
                  >
                    {formatDirectTax(rate)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setIsAdding(true)
              }}
              className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-sm text-primary hover:bg-muted"
            >
              <CirclePlus className="size-4" />
              New {kind} Tax
            </button>
          )}
          <p className="rounded-b-md border-t bg-primary/5 px-3 py-2.5 text-xs">
            <span className="font-semibold">Note:</span> To view or manage {kind}, go to{" "}
            <Link href={ROUTES.directTaxes} className="font-medium text-primary hover:underline">
              Settings &gt; Direct Taxes &gt; {kind} Rates
            </Link>
            .
          </p>
        </PopoverContent>
      </Popover>

      <span className="ml-auto w-24 text-right text-muted-foreground tabular-nums">
        {kind === "TDS" ? "- " : ""}
        {numberFormat.format(amount)}
      </span>

      <DirectTaxDialog
        open={isAdding}
        onOpenChange={setIsAdding}
        kind={kind}
        onSaved={(rate) => {
          onRateAdded(rate)
          pick(rate.id)
        }}
      />
    </div>
  )
}
