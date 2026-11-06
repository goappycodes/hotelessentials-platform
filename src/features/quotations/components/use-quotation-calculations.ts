"use client"

import { useEffect, useRef } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"

import type { QuotationFormOptions, QuoteCustomer } from "@/features/quotations/queries"
import { isEmptyLine } from "@/features/quotations/quotation-input"
import { computeQuotationTotals, defaultTaxIdFor } from "@/lib/quotations"
import type { QuotationInput } from "@/lib/validations/quotation"

const num = (value: string) => Number(value || 0)

// What the quotation and sales order forms share: live totals, and line taxes that follow
// the customer and place of supply.
export function useQuotationCalculations({
  form,
  customer,
  options,
  directTaxes = [],
}: {
  form: UseFormReturn<QuotationInput>
  customer: QuoteCustomer | null
  options: Pick<QuotationFormOptions, "taxes" | "businessState">
  directTaxes?: QuotationFormOptions["directTaxes"]
}) {
  const { control, setValue, getValues } = form

  const values = useWatch({ control })
  const isOverseas = customer?.gst_treatment === "Overseas"

  const totals = computeQuotationTotals({
    lines: (values.lines ?? []).map((line) => ({
      quantity: num(line?.quantity ?? ""),
      rate: num(line?.rate ?? ""),
      discountValue: num(line?.discountValue ?? ""),
      discountIsPercent: line?.discountIsPercent ?? true,
      taxId: line?.taxId || null,
    })),
    discountLevel: values.discountLevel ?? "Transaction",
    discountValue: num(values.discountValue ?? ""),
    discountIsPercent: values.discountIsPercent ?? true,
    isDiscountBeforeTax: values.isDiscountBeforeTax ?? true,
    adjustment: num(values.adjustment ?? ""),
    taxes: options.taxes,
    directTax: (() => {
      const rate = directTaxes.find((entry) => entry.id === values.directTaxId)
      return rate && rate.kind === values.taxDeductionType
        ? { kind: rate.kind, rate: rate.rate }
        : null
    })(),
  })

  // Lines from items follow the place of supply: CGST + SGST in the business's own
  // state, IGST elsewhere. Lines whose tax was changed by hand to something else stay.
  function retaxLines(placeOfSupply: string, overseas: boolean) {
    getValues("lines").forEach((line, index) => {
      if (!line.itemIntraTaxId && !line.itemInterTaxId) return
      const taxId = defaultTaxIdFor(
        { intraTaxId: line.itemIntraTaxId || null, interTaxId: line.itemInterTaxId || null },
        placeOfSupply || null,
        options.businessState,
        overseas
      )
      setValue(`lines.${index}.taxId`, taxId ?? "", { shouldDirty: true })
    })
  }

  // Picking a customer brings in their place of supply and price list.
  const previousCustomer = useRef(values.customerId)
  useEffect(() => {
    if (previousCustomer.current === values.customerId) return
    previousCustomer.current = values.customerId
    if (!customer) return
    const overseas = customer.gst_treatment === "Overseas"
    const placeOfSupply = overseas ? "" : (customer.place_of_supply ?? "")
    setValue("placeOfSupply", placeOfSupply, { shouldDirty: true })
    setValue("priceListId", customer.price_list_id ?? "", { shouldDirty: true })
    retaxLines(placeOfSupply, overseas)
    // retaxLines only reads current values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.customerId, customer])

  // Changing the place of supply by hand re-picks the line taxes too.
  const previousPlace = useRef(values.placeOfSupply)
  useEffect(() => {
    if (previousPlace.current === values.placeOfSupply) return
    previousPlace.current = values.placeOfSupply
    retaxLines(values.placeOfSupply ?? "", isOverseas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.placeOfSupply])

  // Rows left empty aren't saved. One stays, to ask for an item.
  function dropEmptyLines() {
    const lines = getValues("lines")
    const filled = lines.filter((line) => !isEmptyLine(line))
    if (filled.length < lines.length) {
      setValue("lines", filled.length > 0 ? filled : lines.slice(0, 1))
    }
  }

  return { values, totals, isOverseas, dropEmptyLines }
}
