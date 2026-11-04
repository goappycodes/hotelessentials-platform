import { z } from "zod"

import {
  ADJUSTMENT_ACCOUNTS,
  ADJUSTMENT_MODES,
  ADJUSTMENT_STATUSES,
  MAX_ADJUSTMENT_ITEMS,
} from "@/constants/inventory"

// A stock change as typed: "+10", "-2.5" or "10" (up to 4 decimals), never zero.
export const ADJUSTED_QUANTITY_PATTERN = /^[+-]?\d{1,11}(\.\d{1,4})?$/

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`)

export const adjustmentLineSchema = z.object({
  // Empty while the row has no item picked yet; such rows are skipped.
  itemId: z.union([z.uuid(), z.literal("")]),
  quantityAdjusted: z.string().trim(),
})

export const inventoryAdjustmentSchema = z
  .object({
    mode: z.enum(ADJUSTMENT_MODES),
    referenceNumber: optionalText(50, "Reference number"),
    date: z.iso.date("Pick a date"),
    account: z.enum(ADJUSTMENT_ACCOUNTS),
    reason: z
      .string()
      .trim()
      .min(1, "Pick or type a reason")
      .max(100, "Reason must be at most 100 characters"),
    description: optionalText(500, "Description"),
    items: z.array(adjustmentLineSchema).max(MAX_ADJUSTMENT_ITEMS),
  })
  .superRefine((adjustment, context) => {
    if (adjustment.mode !== "Quantity Adjustment") {
      context.addIssue({
        code: "custom",
        path: ["mode"],
        message: "Value adjustments aren't available yet",
      })
    }

    const seen = new Set<string>()
    adjustment.items.forEach((line, index) => {
      if (!line.itemId) {
        if (line.quantityAdjusted) {
          context.addIssue({
            code: "custom",
            path: ["items", index, "itemId"],
            message: "Pick an item",
          })
        }
        return
      }
      if (seen.has(line.itemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "itemId"],
          message: "This item is already in the table",
        })
      }
      seen.add(line.itemId)
      if (
        !ADJUSTED_QUANTITY_PATTERN.test(line.quantityAdjusted) ||
        Number(line.quantityAdjusted) === 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "quantityAdjusted"],
          message: "Enter a change like +10 or -10",
        })
      }
    })

    if (seen.size === 0) {
      context.addIssue({ code: "custom", path: ["items"], message: "Add at least one item" })
    }
  })

export const adjustmentStatusSchema = z.enum(ADJUSTMENT_STATUSES)

export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>
export type AdjustmentLineInput = z.infer<typeof adjustmentLineSchema>
