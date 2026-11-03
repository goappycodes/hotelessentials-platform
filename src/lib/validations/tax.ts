import { z } from "zod"

import { TAX_SCOPES } from "@/constants/taxes"

// Percentages as entered in the form: 0–100 with up to two decimals, e.g. "9" or "2.5".
const percentage = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100), {
    message: "Enter a percentage from 0 to 100",
  })

export const taxRateSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(50, "Name must be at most 50 characters"),
    taxScope: z.enum(TAX_SCOPES),
    cgstRate: percentage,
    sgstRate: percentage,
    igstRate: percentage,
    isActive: z.boolean(),
  })
  .superRefine((tax, context) => {
    const required =
      tax.taxScope === "Intra-state" ? (["cgstRate", "sgstRate"] as const) : (["igstRate"] as const)
    for (const field of required) {
      if (!tax[field]) {
        context.addIssue({ code: "custom", path: [field], message: "Enter a percentage" })
      }
    }
  })

export type TaxRateInput = z.infer<typeof taxRateSchema>
