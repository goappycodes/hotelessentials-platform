"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import { ITEM_IMPORT_BATCH_SIZE } from "@/constants/items"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import {
  IMPORT_DUPLICATE_MODES,
  itemImportRowSchema,
  type ImportDuplicateMode,
  type ItemImportRow,
} from "@/lib/validations/item-import"
import type { ActionResult } from "@/types/actions"
import type { TablesInsert } from "@/types/database"

// Lookups with .in() go in the URL, so long lists are split.
const LOOKUP_CHUNK = 100

const batchSchema = z.array(itemImportRowSchema).min(1).max(ITEM_IMPORT_BATCH_SIZE)

export type ItemImportResult = {
  created: number
  updated: number
  // Rows matching an existing item, left alone ("Skip duplicates").
  skipped: number
  failed: { row: number; name: string; message: string }[]
}

type Client = Awaited<ReturnType<typeof createClient>>

function chunks<T>(values: T[], size = LOOKUP_CHUNK) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

const isUuid = (value: string) => z.uuid().safeParse(value).success

function importErrorMessage(error: PostgrestError) {
  if (error.code === "23505") return "Another item already uses this Item ID"
  // Messages written for users by the database (tax scope, locked items).
  if (["23514", "42501"].includes(error.code) && !error.message.includes("violates")) {
    return error.message
  }
  return getDatabaseErrorMessage(error)
}

// HSN code → id, adding codes that don't exist yet (without a description).
async function resolveHsnCodes(supabase: Client, codes: string[]) {
  const ids = new Map<string, string>()
  if (codes.length === 0) return ids

  const { error: insertError } = await supabase
    .from("hsn_codes")
    .upsert(
      codes.map((code) => ({ code })),
      { onConflict: "code", ignoreDuplicates: true }
    )
  if (insertError) throw new Error(importErrorMessage(insertError))

  for (const part of chunks(codes)) {
    const { data, error } = await supabase.from("hsn_codes").select("id, code").in("code", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const hsn of data) ids.set(hsn.code, hsn.id)
  }
  return ids
}

// Existing items matching the rows: by Item ID (an imported item's source ID, or our own
// ID from an export), then by SKU among items added in the app. Keyed by the row number.
async function findExistingItems(supabase: Client, rows: ItemImportRow[]) {
  const byExternalId = new Map<string, string>()
  const byId = new Set<string>()
  const bySku = new Map<string, string>()

  const externalIds = rows.flatMap((row) => (row.externalId ? [row.externalId] : []))
  for (const part of chunks(externalIds)) {
    const { data, error } = await supabase.from("items").select("id, external_id").in("external_id", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const item of data) if (item.external_id) byExternalId.set(item.external_id, item.id)
  }

  const ownIds = externalIds.filter(isUuid)
  for (const part of chunks(ownIds)) {
    const { data, error } = await supabase.from("items").select("id").in("id", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const item of data) byId.add(item.id)
  }

  // SKUs can be shared by different items, so a SKU only matches items added in the app
  // (no external_id): an item imported with another Item ID is a different product.
  const skus = rows.flatMap((row) => (row.sku ? [row.sku] : []))
  for (const part of chunks(skus)) {
    const { data, error } = await supabase
      .from("items")
      .select("id, sku")
      .in("sku", part)
      .is("external_id", null)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const item of data) if (item.sku) bySku.set(item.sku.toLowerCase(), item.id)
  }

  const matches = new Map<number, string>()
  for (const row of rows) {
    const id =
      (row.externalId && byExternalId.get(row.externalId)) ||
      (row.externalId && byId.has(row.externalId) ? row.externalId : undefined) ||
      (row.sku && bySku.get(row.sku.toLowerCase()))
    if (id) matches.set(row.row, id)
  }
  return matches
}

// Writes rows in one request; if that fails (e.g. one locked item or taken Item ID), writes
// them one at a time so only the bad rows fail.
async function writeRows(
  rows: { source: ItemImportRow; values: TablesInsert<"items"> }[],
  write: (values: TablesInsert<"items">[]) => PromiseLike<{ error: PostgrestError | null }>,
  failed: ItemImportResult["failed"]
) {
  if (rows.length === 0) return 0
  const { error } = await write(rows.map((row) => row.values))
  if (!error) return rows.length

  let written = 0
  for (const row of rows) {
    const { error: rowError } = await write([row.values])
    if (rowError) {
      failed.push({ row: row.source.row, name: row.source.name, message: importErrorMessage(rowError) })
    } else {
      written += 1
    }
  }
  return written
}

// Imports one batch of rows read from an item CSV (see features/items/item-csv.ts).
// New items are created; rows matching an existing item are skipped or overwrite it.
export async function importItems(
  rows: ItemImportRow[],
  mode: ImportDuplicateMode
): Promise<ActionResult<ItemImportResult>> {
  const parsed = batchSchema.safeParse(rows)
  const parsedMode = z.enum(IMPORT_DUPLICATE_MODES).safeParse(mode)
  if (!parsed.success || !parsedMode.success) {
    return { success: false, error: "The file has rows that can't be read. Please check it and try again." }
  }

  const session = await fetchSession()
  if (
    !session?.user.isActive ||
    !hasAccess(session, "items", "create") ||
    (parsedMode.data === "overwrite" && !hasAccess(session, "items", "edit"))
  ) {
    return { success: false, error: "You don't have permission to do that." }
  }

  const supabase = await createClient()
  const result: ItemImportResult = { created: 0, updated: 0, skipped: 0, failed: [] }

  try {
    const { data: taxRates, error: taxError } = await supabase
      .from("tax_rates")
      .select("id, name, tax_scope")
    if (taxError) throw new Error(getDatabaseErrorMessage(taxError))
    const taxId = (name: string | null, scope: "Intra-state" | "Inter-state") =>
      name
        ? taxRates.find(
            (tax) => tax.tax_scope === scope && tax.name.toLowerCase() === name.toLowerCase()
          )?.id
        : undefined

    const hsnIds = await resolveHsnCodes(supabase, [
      ...new Set(parsed.data.flatMap((row) => (row.hsnCode ? [row.hsnCode] : []))),
    ])
    const existing = await findExistingItems(supabase, parsed.data)

    const toCreate: { source: ItemImportRow; values: TablesInsert<"items"> }[] = []
    const toUpdate: { source: ItemImportRow; values: TablesInsert<"items"> }[] = []

    for (const row of parsed.data) {
      const isTaxable = row.taxPreference === "Taxable"
      const intraId = isTaxable ? taxId(row.intraTaxName, "Intra-state") : null
      const interId = isTaxable ? taxId(row.interTaxName, "Inter-state") : null
      if (isTaxable && (!intraId || !interId)) {
        const missing = !intraId ? row.intraTaxName : row.interTaxName
        result.failed.push({
          row: row.row,
          name: row.name,
          message: `Tax "${missing}" isn't in Settings → Taxes`,
        })
        continue
      }

      const existingId = existing.get(row.row)
      if (existingId && parsedMode.data === "skip") {
        result.skipped += 1
        continue
      }

      const values: TablesInsert<"items"> = {
        ...(existingId ? { id: existingId } : {}),
        // Keep the source ID; our own IDs (from an export) aren't stored again.
        external_id: row.externalId && !isUuid(row.externalId) ? row.externalId : null,
        name: row.name,
        type: row.type,
        sku: row.sku,
        unit: row.unit,
        hsn_code_id: row.hsnCode ? (hsnIds.get(row.hsnCode) ?? null) : null,
        tax_preference: row.taxPreference,
        intra_state_tax_id: intraId ?? null,
        inter_state_tax_id: interId ?? null,
        sales_enabled: row.salesEnabled,
        selling_price: row.sellingPrice,
        sales_account: row.salesAccount,
        sales_description: row.salesDescription,
        purchase_enabled: row.purchaseEnabled,
        cost_price: row.costPrice,
        purchase_account: row.purchaseAccount,
        purchase_description: row.purchaseDescription,
        preferred_vendor: row.preferredVendor,
        track_inventory: row.type === "Goods" && row.trackInventory,
        inventory_account: row.inventoryAccount,
        inventory_valuation_method: row.inventoryValuationMethod,
        is_active: row.isActive,
      }
      // An overwritten item keeps its external_id unless the file gives one.
      if (existingId && !values.external_id) delete values.external_id
      ;(existingId ? toUpdate : toCreate).push({ source: row, values })
    }

    result.created = await writeRows(
      toCreate,
      (values) => supabase.from("items").insert(values),
      result.failed
    )
    // Rows in one upsert must have the same columns (a missing one would be written as
    // null), so updates with and without an external_id go separately.
    const upsert = (values: TablesInsert<"items">[]) =>
      supabase.from("items").upsert(values, { onConflict: "id" })
    result.updated =
      (await writeRows(
        toUpdate.filter((row) => "external_id" in row.values),
        upsert,
        result.failed
      )) +
      (await writeRows(
        toUpdate.filter((row) => !("external_id" in row.values)),
        upsert,
        result.failed
      ))
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "The import failed. Please try again.",
    }
  }

  result.failed.sort((a, b) => a.row - b.row)
  return { success: true, data: result }
}
