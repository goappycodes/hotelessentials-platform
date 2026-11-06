import type { Enums } from "@/types/database"

export type AdjustmentMode = Enums<"adjustment_mode">
export type AdjustmentStatus = Enums<"adjustment_status">

export const ADJUSTMENT_MODES = [
  "Quantity Adjustment",
  "Value Adjustment",
] as const satisfies readonly AdjustmentMode[]

// Drafts don't change stock; adjusted ones do.
export const ADJUSTMENT_STATUSES = ["Draft", "Adjusted"] as const satisfies readonly AdjustmentStatus[]

// Where the cost of the adjusted stock is recorded.
export const ADJUSTMENT_ACCOUNTS = [
  "Cost of Goods Sold",
  "Inventory Shrinkage",
  "Other Expenses",
] as const

// Suggestions for an adjustment's reason, like Zoho's; any reason can be typed.
export const ADJUSTMENT_REASONS = [
  "Stock on fire",
  "Stolen goods",
  "Damaged goods",
  "Stock written off",
  "Stocktaking results",
  "Inventory revaluation",
]

// Worked out by the inventory_list view from available stock and the reorder level.
export const STOCK_STATUSES = ["In Stock", "Low Stock", "Out of Stock"] as const
export type StockStatus = (typeof STOCK_STATUSES)[number]

// Items an adjustment can hold.
export const MAX_ADJUSTMENT_ITEMS = 100
