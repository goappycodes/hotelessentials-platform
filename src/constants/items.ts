import type { Enums } from "@/types/database"

export type ItemType = Enums<"item_type">
export type TaxPreference = Enums<"tax_preference">

export const ITEM_TYPES = ["Goods", "Service"] as const satisfies readonly ItemType[]

export const TAX_PREFERENCES = [
  "Taxable",
  "Non-Taxable",
  "Out of Scope",
  "Non-GST Supply",
] as const satisfies readonly TaxPreference[]

// Suggestions for the unit field; any unit can be typed.
export const ITEM_UNITS = ["pcs", "nos", "set", "box", "pack", "kg", "g", "ltr", "ml", "m", "cm", "dozen", "pair"]

export const SALES_ACCOUNTS = [
  "Sales",
  "General Income",
  "Interest Income",
  "Other Charges",
  "Shipping Charge",
  "Discount",
] as const

export const PURCHASE_ACCOUNTS = [
  "Cost of Goods Sold",
  "Purchase Discounts",
  "Materials",
  "Freight and Forwarding Charges",
  "Repairs and Maintenance",
  "Other Expenses",
] as const

// Stock accounts an inventory item can use (Zoho's "Stock" group).
export const INVENTORY_ACCOUNTS = ["Inventory Asset"] as const

export const INVENTORY_VALUATION_METHODS = [
  "FIFO (First In, First Out)",
  "WAC (Weighted Average Costing)",
] as const satisfies readonly Enums<"inventory_valuation_method">[]

// Item imports are sent to the server in batches of this many rows (and no more).
export const ITEM_IMPORT_BATCH_SIZE = 250

export const MAX_ITEM_IMAGES = 5
export const MAX_ITEM_IMAGE_BYTES = 5 * 1024 * 1024
export const ITEM_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
export const ITEM_IMAGES_BUCKET = "item-images"
