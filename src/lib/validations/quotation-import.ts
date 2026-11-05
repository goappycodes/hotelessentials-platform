import { z } from "zod"

import { MAX_QUOTATION_LINES } from "@/lib/validations/quotation"

const optionalText = (max: number) => z.string().max(max).nullable()

// One line of a quotation read from a CSV. Amounts are numbers here: the file was already
// read and checked in the browser, and the server checks it again with this schema.
const importLineSchema = z.object({
  // The row in the file, for reporting problems.
  row: z.number().int().positive(),
  name: z.string().min(1).max(200),
  // Zoho's Product ID, or our own item ID from an export.
  itemExternalId: optionalText(100),
  description: optionalText(1000),
  hsnCode: optionalText(8),
  unit: optionalText(20),
  quantity: z.number().positive(),
  rate: z.number().min(0),
  discountValue: z.number().min(0),
  discountIsPercent: z.boolean(),
  taxName: optionalText(100),
})

// One quotation read from a CSV: its first row's details and all its lines.
export const quotationImportSchema = z.object({
  row: z.number().int().positive(),
  quoteNumber: z.string().min(1).max(30),
  customerName: z.string().min(1).max(250),
  // Zoho's Customer ID, or our own ID from an export.
  customerExternalId: optionalText(100),
  quoteDate: z.iso.date(),
  expiryDate: z.iso.date().nullable(),
  referenceNumber: optionalText(50),
  subject: optionalText(250),
  placeOfSupply: z.string().regex(/^[0-9]{2}$/).nullable(),
  status: z.enum(["Draft", "Sent", "Accepted", "Declined"]),
  discountLevel: z.enum(["Transaction", "Line Item"]),
  discountValue: z.number().min(0),
  discountIsPercent: z.boolean(),
  isDiscountBeforeTax: z.boolean(),
  adjustment: z.number(),
  adjustmentDescription: optionalText(100),
  notes: optionalText(2000),
  terms: optionalText(5000),
  lines: z.array(importLineSchema).min(1).max(MAX_QUOTATION_LINES),
})

export type QuotationImportRow = z.infer<typeof quotationImportSchema>
export type QuotationImportLine = QuotationImportRow["lines"][number]
