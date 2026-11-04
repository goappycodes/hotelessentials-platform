import { z } from "zod"

import {
  DECIMAL_PLACES,
  PERCENTAGE_TYPES,
  PRICE_LIST_TYPES,
  ROUND_OFF_TYPES,
  TRANSACTION_TYPES,
} from "@/constants/price-lists"
import { MONEY_PATTERN } from "@/lib/format"

export const priceListSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(100, "Name must be at most 100 characters"),
    transactionType: z.enum(TRANSACTION_TYPES),
    priceListType: z.enum(PRICE_LIST_TYPES),
    description: z.string().trim().max(500, "Description must be at most 500 characters"),
    percentageType: z.enum(PERCENTAGE_TYPES),
    percentageValue: z.string().trim(),
    roundOffTo: z.enum(ROUND_OFF_TYPES),
    decimalPlaces: z.enum(DECIMAL_PLACES),
    // Individual Items: custom rate per item id; blank means the item is not in the list.
    itemRates: z.record(z.uuid(), z.string().trim()),
    isActive: z.boolean(),
  })
  .superRefine((list, context) => {
    if (list.priceListType === "All Items") {
      const value = list.percentageValue
      // numeric(10, 4): up to 6 digits before the point and 4 after.
      if (!/^\d{1,6}(\.\d{1,4})?$/.test(value)) {
        context.addIssue({
          code: "custom",
          path: ["percentageValue"],
          message: "Enter a percentage like 10, 12.5 or 7.125 (up to 4 decimals)",
        })
      } else if (list.percentageType === "Markdown" && Number(value) > 100) {
        context.addIssue({
          code: "custom",
          path: ["percentageValue"],
          message: "A markdown can't be more than 100%",
        })
      }
      return
    }

    const rates = Object.entries(list.itemRates).filter(([, rate]) => rate !== "")
    if (rates.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["itemRates"],
        message: "Enter a custom rate for at least one item",
      })
    }
    if (rates.some(([, rate]) => !MONEY_PATTERN.test(rate))) {
      context.addIssue({
        code: "custom",
        path: ["itemRates"],
        message: "Custom rates must be amounts like 1200, 99.50 or 99.982 (up to 4 decimals)",
      })
    }
  })

export type PriceListInput = z.infer<typeof priceListSchema>
