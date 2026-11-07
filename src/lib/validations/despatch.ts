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

// One row per item and box, so an item can be split across boxes. Quantities are strings in
// the form, and a row left empty or at 0 isn't part of the despatch.
export const despatchSchema = despatchDetailsSchema
  .extend({
    salesOrderId: z.uuid(),
    lines: z.array(
      z.object({
        salesOrderItemId: z.uuid(),
        boxNumber: optionalText(20, "Box number"),
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

    const seen = new Set<string>()
    despatch.lines.forEach((line, index) => {
      if (!(Number(line.quantity) > 0)) return
      const path = ["lines", index, "boxNumber"]
      if (!line.boxNumber) {
        context.addIssue({ code: "custom", path, message: "Enter a box number" })
        return
      }
      const key = `${line.salesOrderItemId}:${line.boxNumber.toLowerCase()}`
      if (seen.has(key)) {
        context.addIssue({ code: "custom", path, message: "Already in this box" })
      }
      seen.add(key)
    })
  })

export type DespatchInput = z.infer<typeof despatchSchema>
