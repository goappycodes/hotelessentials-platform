"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import { CUSTOMER_IMPORT_BATCH_SIZE } from "@/constants/customers"
import type { CsvImportResult } from "@/lib/csv-import"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import {
  customerImportRowSchema,
  type CustomerImportRow,
} from "@/lib/validations/customer-import"
import type { ActionResult } from "@/types/actions"
import type { TablesInsert } from "@/types/database"

// Lookups with .in() go in the URL, so long lists are split.
const LOOKUP_CHUNK = 100

const batchSchema = z.array(customerImportRowSchema).min(1).max(CUSTOMER_IMPORT_BATCH_SIZE)

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
  if (error.code === "23505") return "Another customer already uses this Contact ID"
  if (error.message.includes("gstin_for_registered")) return "A GSTIN is required for this GST treatment"
  return getDatabaseErrorMessage(error)
}

// Existing customers matching the rows, keyed by row number: by Contact ID (an imported
// customer's source ID, or our own ID from an export), then by exact display name among
// customers added in the app (imported ones are told apart by their Contact ID).
async function findExistingCustomers(supabase: Client, rows: CustomerImportRow[]) {
  const byExternalId = new Map<string, string>()
  const byId = new Set<string>()
  const byName = new Map<string, string>()

  const externalIds = rows.flatMap((row) => (row.externalId ? [row.externalId] : []))
  for (const part of chunks(externalIds)) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, external_id")
      .in("external_id", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const customer of data) if (customer.external_id) byExternalId.set(customer.external_id, customer.id)
  }

  for (const part of chunks(externalIds.filter(isUuid))) {
    const { data, error } = await supabase.from("customers").select("id").in("id", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const customer of data) byId.add(customer.id)
  }

  for (const part of chunks(rows.map((row) => row.display_name))) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, display_name")
      .in("display_name", part)
      .is("external_id", null)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const customer of data) byName.set(customer.display_name, customer.id)
  }

  const matches = new Set<number>()
  for (const row of rows) {
    const found =
      (row.externalId && (byExternalId.has(row.externalId) || byId.has(row.externalId))) ||
      byName.has(row.display_name)
    if (found) matches.add(row.row)
  }
  return matches
}

// Imports one batch of customers read from a CSV (see features/customers/customer-csv.ts).
// New customers are added; rows matching an existing customer are skipped.
export async function importCustomers(
  rows: CustomerImportRow[]
): Promise<ActionResult<CsvImportResult>> {
  const parsed = batchSchema.safeParse(rows)
  if (!parsed.success) {
    return { success: false, error: "The file has rows that can't be read. Please check it and try again." }
  }

  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "customers", "create")) {
    return { success: false, error: "You don't have permission to do that." }
  }

  const supabase = await createClient()
  const result: CsvImportResult = { created: 0, updated: 0, skipped: 0, failed: [] }

  try {
    // Price lists by name (sales lists the user can see).
    const { data: priceLists } = await supabase
      .from("price_lists")
      .select("id, name")
      .eq("transaction_type", "Sales")
    const priceListId = (name: string | null) =>
      name
        ? priceLists?.find((list) => list.name.toLowerCase() === name.toLowerCase())?.id ?? null
        : null

    const existing = await findExistingCustomers(supabase, parsed.data)
    const toCreate: { source: CustomerImportRow; values: TablesInsert<"customers"> }[] = []

    for (const row of parsed.data) {
      if (existing.has(row.row)) {
        result.skipped += 1
        continue
      }
      // row, externalId and priceListName aren't customers columns.
      const { externalId, priceListName, ...rest } = row
      const columns: Omit<typeof rest, "row"> & { row?: number } = { ...rest }
      delete columns.row
      toCreate.push({
        source: row,
        values: {
          ...columns,
          // Keep the source ID; our own IDs (from an export) aren't stored again.
          external_id: externalId && !isUuid(externalId) ? externalId : null,
          price_list_id: priceListId(priceListName),
        },
      })
    }

    if (toCreate.length) {
      const { error } = await supabase.from("customers").insert(toCreate.map((entry) => entry.values))
      if (!error) {
        result.created = toCreate.length
      } else {
        // One bad row fails the whole insert: try them one at a time so only it fails.
        for (const entry of toCreate) {
          const { error: rowError } = await supabase.from("customers").insert(entry.values)
          if (rowError) {
            result.failed.push({
              row: entry.source.row,
              name: entry.source.display_name,
              message: importErrorMessage(rowError),
            })
          } else {
            result.created += 1
          }
        }
      }
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
