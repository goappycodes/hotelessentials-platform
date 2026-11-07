"use server"

import { z } from "zod"

import { DESPATCH_IMPORT_BATCH_SIZE } from "@/constants/despatch"
import { getDespatchErrorMessage } from "@/features/despatch/despatch-errors"
import type { CsvImportResult } from "@/lib/csv-import"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import { despatchImportSchema, type DespatchImportRow } from "@/lib/validations/despatch-import"
import type { ActionResult } from "@/types/actions"

const batchSchema = z.array(despatchImportSchema).min(1).max(DESPATCH_IMPORT_BATCH_SIZE)

const matches = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase())

// Imports one batch of despatches read from a file (see features/despatch/despatch-csv.ts).
// Each goes in on its own through public.save_despatch, so the same rules apply as in the
// app: the order must be Confirmed, quantities can't pass what's left on it, and tracked
// items need the stock. A number that already exists is skipped, so importing a file again
// changes nothing.
export async function importDespatches(
  rows: DespatchImportRow[]
): Promise<ActionResult<CsvImportResult>> {
  const parsed = batchSchema.safeParse(rows)
  if (!parsed.success) {
    return { success: false, error: "The file has rows that can't be read. Please check it and try again." }
  }

  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "despatch", "create")) {
    return { success: false, error: "You don't have permission to do that." }
  }

  const supabase = await createClient()
  const result: CsvImportResult = { created: 0, updated: 0, skipped: 0, failed: [] }

  try {
    const numbers = parsed.data.map((despatch) => despatch.despatchNumber)
    const soNumbers = [...new Set(parsed.data.map((despatch) => despatch.soNumber))]
    const [existingResult, ordersResult] = await Promise.all([
      supabase.from("despatches").select("despatch_number").in("despatch_number", numbers),
      supabase
        .from("sales_orders")
        .select("id, so_number, lines:sales_order_items(id, name, item:items(sku))")
        .in("so_number", soNumbers),
    ])
    if (existingResult.error) throw new Error(getDatabaseErrorMessage(existingResult.error))
    if (ordersResult.error) throw new Error(getDatabaseErrorMessage(ordersResult.error))

    const existing = new Set(existingResult.data.map((despatch) => despatch.despatch_number))
    const orders = new Map(ordersResult.data.map((order) => [order.so_number, order]))

    for (const despatch of parsed.data) {
      if (existing.has(despatch.despatchNumber)) {
        result.skipped += 1
        continue
      }
      const fail = (message: string, row = despatch.row) =>
        result.failed.push({ row, name: despatch.despatchNumber, message })

      const noBox = despatch.lines.find((line) => !line.boxNumber)
      if (noBox) {
        fail("Box Number is blank", noBox.row)
        continue
      }

      const order = orders.get(despatch.soNumber)
      if (!order) {
        fail(`Sales order "${despatch.soNumber}" isn't in Sales Orders`)
        continue
      }

      // Each file line takes an order line, by SKU or else by name. An order line can fill
      // several boxes, but only once in each.
      const used = new Set<string>()
      const free = (id: string, box: string) => !used.has(`${id}:${box.toLowerCase()}`)
      const items: { sales_order_item_id: string; box_number: string; quantity: number }[] = []
      const missing = despatch.lines.find((line) => {
        const box = line.boxNumber ?? ""
        const match =
          order.lines.find((entry) => free(entry.id, box) && matches(entry.item?.sku, line.sku)) ??
          order.lines.find((entry) => free(entry.id, box) && matches(entry.name, line.name))
        if (!match) return true
        used.add(`${match.id}:${box.toLowerCase()}`)
        items.push({ sales_order_item_id: match.id, box_number: box, quantity: line.quantity })
        return false
      })
      if (missing) {
        fail(`"${missing.name}" isn't on ${despatch.soNumber}`, missing.row)
        continue
      }

      const { error } = await supabase.rpc("save_despatch", {
        despatch: {
          despatch_number: despatch.despatchNumber,
          sales_order_id: order.id,
          despatch_date: despatch.despatchDate,
          status: despatch.status,
          transporter: despatch.transporter,
          tracking_number: despatch.trackingNumber,
          vehicle_number: despatch.vehicleNumber,
          notes: despatch.notes,
        },
        items,
      })

      if (!error) result.created += 1
      else if (error.code === "23505" && error.message.includes("despatch_number")) result.skipped += 1
      else fail(getDespatchErrorMessage(error))
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "The import failed. Please try again.",
    }
  }

  result.failed.sort((a, b) => a.row - b.row)
  return { success: true, data: result }
}
