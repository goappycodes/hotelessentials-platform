// Quotation maths, used by the form (live totals) and the save action (stored totals),
// so both always agree. Amounts are rounded to paise only at the end of each step.

import type { TaxRate } from "@/features/taxes/tax-rates"
import type { Enums } from "@/types/database"

export type QuotationLineValues = {
  quantity: number
  rate: number
  discountValue: number
  discountIsPercent: boolean
  taxId: string | null
}

export type QuotationTotalsInput = {
  lines: QuotationLineValues[]
  discountLevel: Enums<"discount_level">
  // Whole-quote discount (used when discountLevel is "Transaction").
  discountValue: number
  discountIsPercent: boolean
  isDiscountBeforeTax: boolean
  adjustment: number
  taxes: readonly TaxRate[]
}

export type TaxBreakdownLine = { label: string; amount: number }

export type QuotationTotals = {
  // Each line's amount after its own discount, before tax.
  lineAmounts: number[]
  subTotal: number
  // The whole-quote discount (Transaction level), shown as its own line.
  transactionDiscount: number
  // All discounts: line discounts plus the whole-quote one.
  discountTotal: number
  // CGST / SGST / IGST by rate, e.g. "CGST9 (9%)".
  taxBreakdown: TaxBreakdownLine[]
  taxTotal: number
  total: number
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function discountOn(base: number, value: number, isPercent: boolean) {
  if (base <= 0 || value <= 0) return 0
  return isPercent ? (base * Math.min(value, 100)) / 100 : Math.min(value, base)
}

const percent = (value: number) => `${Number(value.toFixed(2))}%`

export function computeQuotationTotals(input: QuotationTotalsInput): QuotationTotals {
  const isLineLevel = input.discountLevel === "Line Item"

  const lineAmounts = input.lines.map((line) => {
    const gross = line.quantity * line.rate
    const lineDiscount = isLineLevel ? discountOn(gross, line.discountValue, line.discountIsPercent) : 0
    return round2(gross - lineDiscount)
  })
  const lineDiscounts = input.lines.map((line, index) =>
    round2(line.quantity * line.rate - lineAmounts[index])
  )

  const subTotal = round2(lineAmounts.reduce((sum, amount) => sum + amount, 0))
  const transactionDiscount = isLineLevel
    ? 0
    : round2(discountOn(subTotal, input.discountValue, input.discountIsPercent))

  // A discount before tax lowers every line's taxable value by the same share.
  const taxableShare =
    input.isDiscountBeforeTax && subTotal > 0 ? (subTotal - transactionDiscount) / subTotal : 1

  // Tax per component, so CGST and SGST show separately like on a GST invoice.
  const components = new Map<string, number>()
  const add = (label: string, amount: number) =>
    components.set(label, (components.get(label) ?? 0) + amount)

  input.lines.forEach((line, index) => {
    const tax = line.taxId ? input.taxes.find((entry) => entry.id === line.taxId) : undefined
    if (!tax) return
    const taxable = lineAmounts[index] * taxableShare
    if (tax.tax_scope === "Intra-state") {
      const cgst = tax.cgst_rate ?? 0
      const sgst = tax.sgst_rate ?? 0
      if (cgst > 0) add(`CGST${Number(cgst.toFixed(2))} (${percent(cgst)})`, (taxable * cgst) / 100)
      if (sgst > 0) add(`SGST${Number(sgst.toFixed(2))} (${percent(sgst)})`, (taxable * sgst) / 100)
    } else {
      const igst = tax.igst_rate ?? 0
      if (igst > 0) add(`IGST${Number(igst.toFixed(2))} (${percent(igst)})`, (taxable * igst) / 100)
    }
  })

  const taxBreakdown = [...components].map(([label, amount]) => ({ label, amount: round2(amount) }))
  const taxTotal = round2(taxBreakdown.reduce((sum, line) => sum + line.amount, 0))
  const total = round2(subTotal - transactionDiscount + taxTotal + input.adjustment)

  return {
    lineAmounts,
    subTotal,
    transactionDiscount,
    discountTotal: round2(lineDiscounts.reduce((sum, value) => sum + value, 0) + transactionDiscount),
    taxBreakdown,
    taxTotal,
    total,
  }
}

// A line priced from a price list. A cheaper list price shows as a discount on the
// selling price (10% off), so the customer sees what they save; a higher one (a markup
// list) becomes the rate itself.
export function priceFromList(sellingPrice: number, listRate: number) {
  if (sellingPrice <= 0 || listRate >= sellingPrice) {
    return { rate: listRate, discountPercent: 0 }
  }
  // 8 decimals (as stored), so the line comes to the list price to the paisa.
  const discountPercent = Math.round((1 - listRate / sellingPrice) * 100 * 1e8) / 1e8
  return { rate: sellingPrice, discountPercent }
}

// Which of an item's taxes applies: CGST + SGST when the place of supply is the
// business's own state (or either isn't known yet), IGST for another state, none for
// overseas customers.
export function defaultTaxIdFor(
  item: { intraTaxId: string | null; interTaxId: string | null },
  placeOfSupply: string | null,
  businessState: string | null,
  isOverseas: boolean
) {
  if (isOverseas) return null
  if (!businessState || !placeOfSupply || placeOfSupply === businessState) return item.intraTaxId
  return item.interTaxId
}
