import { z } from "zod"

// A TDS or TCS rate (Settings → Direct Taxes), e.g. "Professional Fees" at 10%.
export const directTaxSchema = z.object({
  kind: z.enum(["TDS", "TCS"]),
  name: z.string().trim().min(1, "Enter a name").max(100, "At most 100 characters"),
  rate: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100,
      "Enter a rate from 0 to 100, like 2 or 7.5"
    ),
})

export type DirectTaxInput = z.infer<typeof directTaxSchema>
