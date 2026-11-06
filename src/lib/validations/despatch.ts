import { z } from "zod"

import { QUANTITY_PATTERN } from "@/lib/format"

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`)

// The details that can still change after a despatch is saved.
export const despatchDetailsSchema = z.object({
  date: z.iso.date("Pick a date"),
  transporter: optionalText(100, "Transporter"),
  trackingNumber: optionalText(100, "Tracking number"),
  vehicleNumber: optionalText(30, "Vehicle number"),
  notes: optionalText(500, "Notes"),
})

export type DespatchDetailsInput = z.infer<typeof despatchDetailsSchema>

// Quantities are strings in the form. A line left empty or at 0 isn't part of the despatch.
export const despatchSchema = despatchDetailsSchema
  .extend({
    salesOrderId: z.uuid(),
    lines: z.array(
      z.object({
        salesOrderItemId: z.uuid(),
        quantity: z
          .string()
          .trim()
          .refine((value) => value === "" || QUANTITY_PATTERN.test(value), {
            message: "Enter a quantity like 10 or 2.5",
          }),
      })
    ),
  })
  .superRefine((despatch, context) => {
    if (!despatch.lines.some((line) => Number(line.quantity) > 0)) {
      context.addIssue({ code: "custom", path: ["lines"], message: "Enter a quantity for at least one item." })
    }
  })

export type DespatchInput = z.infer<typeof despatchSchema>
