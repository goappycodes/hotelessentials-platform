import { z } from "zod"

import { DESPATCH_STATUSES } from "@/features/despatch/list-config"

const optionalText = (max: number) => z.string().max(max).nullable()

// One line of a despatch read from a file.
const importLineSchema = z.object({
  // The row in the file, for reporting problems.
  row: z.number().int().positive(),
  name: z.string().min(1).max(200),
  sku: optionalText(50),
  quantity: z.number().positive(),
})

// One despatch read from a file: its first row's details and all its lines. Quantities are
// numbers here: the file was already read and checked in the browser, and the server checks
// it again with this schema.
export const despatchImportSchema = z.object({
  row: z.number().int().positive(),
  despatchNumber: z.string().min(1).max(30),
  soNumber: z.string().min(1).max(30),
  despatchDate: z.iso.date(),
  status: z.enum(DESPATCH_STATUSES),
  transporter: optionalText(100),
  trackingNumber: optionalText(100),
  vehicleNumber: optionalText(30),
  notes: optionalText(500),
  lines: z.array(importLineSchema).min(1).max(500),
})

export type DespatchImportRow = z.infer<typeof despatchImportSchema>
export type DespatchImportLine = DespatchImportRow["lines"][number]
