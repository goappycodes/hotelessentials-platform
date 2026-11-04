import { z } from "zod"

import {
  INVENTORY_ACCOUNTS,
  INVENTORY_VALUATION_METHODS,
  ITEM_TYPES,
  PURCHASE_ACCOUNTS,
  SALES_ACCOUNTS,
  TAX_PREFERENCES,
} from "@/constants/items"

// Amounts are stored as numeric(15, 4).
const amount = z.number().min(0, "can't be negative").max(99_999_999_999.9999, "is too large")

const optionalText = (max: number) => z.string().max(max, `must be at most ${max} characters`).nullable()

// One item read from an import file, after the columns are mapped (see item-csv.ts).
// Checked in the browser for the preview and again in the import Server Action.
export const itemImportRowSchema = z.object({
  // The row number in the file (the header is row 1), for the import report.
  row: z.number().int().positive(),
  // The item's ID in the source file: a Zoho Item ID, or our own ID from an export.
  externalId: optionalText(100),
  type: z.enum(ITEM_TYPES),
  name: z.string().trim().min(1, "is required").max(200, "must be at most 200 characters"),
  sku: optionalText(50),
  unit: optionalText(20),
  hsnCode: z.string().regex(/^\d{4,8}$/, "must be 4 to 8 digits").nullable(),
  taxPreference: z.enum(TAX_PREFERENCES),
  // Tax names as in Settings → Taxes, e.g. GST18 and IGST18. Required when taxable.
  intraTaxName: optionalText(50),
  interTaxName: optionalText(50),
  salesEnabled: z.boolean(),
  sellingPrice: amount,
  salesAccount: z.enum(SALES_ACCOUNTS),
  salesDescription: optionalText(1000),
  purchaseEnabled: z.boolean(),
  costPrice: amount,
  purchaseAccount: z.enum(PURCHASE_ACCOUNTS),
  purchaseDescription: optionalText(1000),
  preferredVendor: optionalText(100),
  trackInventory: z.boolean(),
  inventoryAccount: z.enum(INVENTORY_ACCOUNTS),
  inventoryValuationMethod: z.enum(INVENTORY_VALUATION_METHODS),
  isActive: z.boolean(),
})

// What to do with a file row that matches an existing item (by Item ID, then SKU).
export const IMPORT_DUPLICATE_MODES = ["skip", "overwrite"] as const

export type ItemImportRow = z.infer<typeof itemImportRowSchema>
export type ImportDuplicateMode = (typeof IMPORT_DUPLICATE_MODES)[number]
