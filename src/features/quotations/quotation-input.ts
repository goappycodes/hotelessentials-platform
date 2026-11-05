// Converting between saved quotations and form values (all strings).
import { DEFAULT_ADJUSTMENT_LABEL, DEFAULT_QUOTATION_TERMS } from "@/constants/quotations"
import { toMoneyInput } from "@/lib/format"
import type { QuotationInput, QuotationLineInput } from "@/lib/validations/quotation"
import type { Tables } from "@/types/database"

export const EMPTY_LINE: QuotationLineInput = {
  itemId: "",
  name: "",
  description: "",
  hsnCode: "",
  unit: "",
  quantity: "1",
  rate: "",
  discountValue: "",
  discountIsPercent: true,
  priceListId: "",
  taxId: "",
  itemIntraTaxId: "",
  itemInterTaxId: "",
}

// A row nothing was entered in: the quantity starts at 1, so it doesn't count. These are
// left out when saving (a new row appears as soon as the last one is filled).
export function isEmptyLine(line: QuotationLineInput) {
  return !line.itemId && !line.name.trim() && !line.rate.trim()
}

export function newQuotationInput(today: string): QuotationInput {
  return {
    customerId: "",
    quoteNumber: "",
    referenceNumber: "",
    quoteDate: today,
    expiryDate: "",
    salespersonId: "",
    subject: "",
    priceListId: "",
    placeOfSupply: "",
    // Discounts are per line, as in the Zoho quote form.
    discountLevel: "Line Item",
    discountValue: "",
    discountIsPercent: true,
    isDiscountBeforeTax: true,
    adjustment: "0.00",
    adjustmentDescription: DEFAULT_ADJUSTMENT_LABEL,
    taxDeductionType: "TDS",
    directTaxId: "",
    notes: "",
    terms: DEFAULT_QUOTATION_TERMS,
    lines: [{ ...EMPTY_LINE }],
  }
}

const money = (value: number) => (value ? toMoneyInput(value) : "")

export function toQuotationInput(
  quote: Tables<"quotations">,
  lines: (Tables<"quotation_items"> & {
    item: { intra_state_tax_id: string | null; inter_state_tax_id: string | null } | null
  })[]
): QuotationInput {
  return {
    customerId: quote.customer_id,
    quoteNumber: quote.quote_number,
    referenceNumber: quote.reference_number ?? "",
    quoteDate: quote.quote_date,
    expiryDate: quote.expiry_date ?? "",
    salespersonId: quote.salesperson_id ?? "",
    subject: quote.subject ?? "",
    priceListId: quote.price_list_id ?? "",
    placeOfSupply: quote.place_of_supply ?? "",
    discountLevel: quote.discount_level,
    discountValue: money(quote.discount_value),
    discountIsPercent: quote.discount_is_percent,
    isDiscountBeforeTax: quote.is_discount_before_tax,
    adjustment: quote.adjustment ? toMoneyInput(quote.adjustment) : "0.00",
    adjustmentDescription: quote.adjustment_description ?? DEFAULT_ADJUSTMENT_LABEL,
    taxDeductionType: quote.tax_deduction_type,
    directTaxId: quote.direct_tax_id ?? "",
    notes: quote.notes ?? "",
    terms: quote.terms ?? "",
    lines: lines.map((line) => ({
      itemId: line.item_id ?? "",
      name: line.name,
      description: line.description ?? "",
      hsnCode: line.hsn_code ?? "",
      unit: line.unit ?? "",
      quantity: toMoneyInput(line.quantity),
      rate: toMoneyInput(line.rate),
      discountValue: money(line.discount_value),
      discountIsPercent: line.discount_is_percent,
      priceListId: line.price_list_id ?? "",
      taxId: line.tax_id ?? "",
      itemIntraTaxId: line.item?.intra_state_tax_id ?? "",
      itemInterTaxId: line.item?.inter_state_tax_id ?? "",
    })),
  }
}

// Today in India, as YYYY-MM-DD (the business is in India; servers run on UTC).
export function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
}
