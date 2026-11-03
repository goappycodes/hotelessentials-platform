import { z } from "zod"

import {
  ITEM_TYPES,
  PURCHASE_ACCOUNTS,
  SALES_ACCOUNTS,
  TAX_PREFERENCES,
} from "@/constants/items"
import { MONEY_PATTERN } from "@/lib/format"

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`)

// Prices are strings in the form and converted to numbers when saved.
const price = z
  .string()
  .trim()
  .refine((value) => value === "" || MONEY_PATTERN.test(value), {
    message: "Enter an amount like 1200 or 99.50",
  })

const optionalId = z.union([z.uuid(), z.literal("")])

export const itemSchema = z
  .object({
    type: z.enum(ITEM_TYPES),
    name: z.string().trim().min(1, "Enter a name").max(200, "Name must be at most 200 characters"),
    sku: optionalText(50, "SKU"),
    unit: optionalText(20, "Unit"),
    hsnCodeId: optionalId,
    taxPreference: z.enum(TAX_PREFERENCES),

    salesEnabled: z.boolean(),
    sellingPrice: price,
    salesAccount: z.enum(SALES_ACCOUNTS),
    salesDescription: optionalText(1000, "Description"),

    purchaseEnabled: z.boolean(),
    costPrice: price,
    purchaseAccount: z.enum(PURCHASE_ACCOUNTS),
    purchaseDescription: optionalText(1000, "Description"),
    preferredVendor: optionalText(100, "Preferred vendor"),

    intraStateTaxId: optionalId,
    interStateTaxId: optionalId,

    trackInventory: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((item, context) => {
    if (item.type === "Goods" && !item.hsnCodeId) {
      context.addIssue({ code: "custom", path: ["hsnCodeId"], message: "Goods need an HSN code" })
    }
    if (item.taxPreference === "Taxable" && !item.intraStateTaxId) {
      context.addIssue({ code: "custom", path: ["intraStateTaxId"], message: "Pick an intra-state tax" })
    }
    if (item.taxPreference === "Taxable" && !item.interStateTaxId) {
      context.addIssue({ code: "custom", path: ["interStateTaxId"], message: "Pick an inter-state tax" })
    }
    if (item.salesEnabled && !item.sellingPrice) {
      context.addIssue({ code: "custom", path: ["sellingPrice"], message: "Enter a selling price" })
    }
    if (item.purchaseEnabled && !item.costPrice) {
      context.addIssue({ code: "custom", path: ["costPrice"], message: "Enter a cost price" })
    }
  })

export const hsnCodeSchema = z.object({
  code: z.string().trim().regex(/^[0-9]{4,8}$/, "Use 4 to 8 digits"),
  description: z
    .string()
    .trim()
    .min(1, "Enter a description")
    .max(300, "Description must be at most 300 characters"),
})

export type ItemInput = z.infer<typeof itemSchema>
export type HsnCodeInput = z.infer<typeof hsnCodeSchema>
