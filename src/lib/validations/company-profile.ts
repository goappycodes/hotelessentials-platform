import { z } from "zod"

import { GSTIN_PATTERN } from "@/lib/validations/customer"

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} can be at most ${max} characters`)

// The business's details printed on quotations (Settings → Taxes).
export const companyProfileSchema = z.object({
  companyName: text(150, "Company name"),
  address: text(500, "Address"),
  phone: text(50, "Phone"),
  email: z.union([z.literal(""), z.email("Enter a valid email").max(150)]),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || GSTIN_PATTERN.test(value), "Enter a valid 15-character GSTIN"),
  bankDetails: text(1000, "Bank details"),
})

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>
