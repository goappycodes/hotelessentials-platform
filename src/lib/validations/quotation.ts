import { z } from "zod"

import { MONEY_PATTERN, MONEY_PATTERN_MESSAGE, QUANTITY_PATTERN } from "@/lib/format"

export const MAX_QUOTATION_LINES = 300

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`)

const optionalId = z.union([z.uuid(), z.literal("")])

// Amounts are strings in the form (like everywhere else) and numbers when saved.
const money = z
  .string()
  .trim()
  .refine((value) => value === "" || MONEY_PATTERN.test(value), MONEY_PATTERN_MESSAGE)

export const quotationLineSchema = z
  .object({
    // The item it came from; empty for a line typed by hand.
    itemId: optionalId,
    name: text(200, "Item name").min(1, "Pick an item or type a name"),
    description: text(1000, "Description"),
    hsnCode: text(8, "HSN code"),
    unit: text(20, "Unit"),
    quantity: z
      .string()
      .trim()
      .refine((value) => QUANTITY_PATTERN.test(value) && Number(value) > 0, "Enter a quantity above 0"),
    rate: money.refine((value) => value !== "", "Enter a rate"),
    // Up to 8 decimals: percentages from price lists are exact (9.99918605%).
    discountValue: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d{1,10}(\.\d{1,8})?$/.test(value), MONEY_PATTERN_MESSAGE),
    discountIsPercent: z.boolean(),
    // The sales price list the line is priced from; its discount comes from the list.
    priceListId: optionalId,
    taxId: optionalId,
    // The item's own taxes, so the form can switch the line between CGST + SGST and
    // IGST when the place of supply changes. Not saved.
    itemIntraTaxId: optionalId,
    itemInterTaxId: optionalId,
  })
  .superRefine((line, context) => {
    if (line.discountIsPercent && Number(line.discountValue || 0) > 100) {
      context.addIssue({ code: "custom", path: ["discountValue"], message: "At most 100%" })
    }
  })

export const quotationSchema = z
  .object({
    customerId: z.uuid("Pick a customer"),
    // Blank: the next QT-000001-style number is used.
    quoteNumber: text(30, "Quote number"),
    referenceNumber: text(50, "Reference number"),
    quoteDate: z.iso.date("Pick a date"),
    expiryDate: z.union([z.iso.date(), z.literal("")]),
    salespersonId: optionalId,
    subject: text(250, "Subject"),
    priceListId: optionalId,
    placeOfSupply: z.string().regex(/^([0-9]{2})?$/, "Pick a state"),
    discountLevel: z.enum(["Transaction", "Line Item"]),
    discountValue: money,
    discountIsPercent: z.boolean(),
    isDiscountBeforeTax: z.boolean(),
    // Can be negative, e.g. -0.40 to round off.
    adjustment: z
      .string()
      .trim()
      .refine((value) => value === "" || /^-?\d{1,11}(\.\d{1,4})?$/.test(value), "Enter an amount like 10 or -0.40"),
    adjustmentDescription: text(100, "Adjustment label"),
    // TDS (comes off the total) or TCS (added), and the rate picked for it.
    taxDeductionType: z.enum(["TDS", "TCS"]),
    directTaxId: optionalId,
    notes: text(2000, "Customer notes"),
    terms: text(5000, "Terms & conditions"),
    lines: z
      .array(quotationLineSchema)
      .min(1, "Add at least one item")
      .max(MAX_QUOTATION_LINES, `At most ${MAX_QUOTATION_LINES} items`),
  })
  .superRefine((quote, context) => {
    if (quote.expiryDate && quote.expiryDate < quote.quoteDate) {
      context.addIssue({ code: "custom", path: ["expiryDate"], message: "Can't be before the quote date" })
    }
    if (quote.discountIsPercent && Number(quote.discountValue || 0) > 100) {
      context.addIssue({ code: "custom", path: ["discountValue"], message: "At most 100%" })
    }
  })

export type QuotationInput = z.infer<typeof quotationSchema>
export type QuotationLineInput = z.infer<typeof quotationLineSchema>
