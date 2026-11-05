"use server"

import { z } from "zod"

import { QUOTATION_IMPORT_BATCH_SIZE } from "@/constants/quotations"
import { TAX_RATE_COLUMNS } from "@/features/taxes/tax-rates"
import type { CsvImportResult } from "@/lib/csv-import"
import { hasAccess } from "@/lib/permissions"
import { computeQuotationTotals } from "@/lib/quotations"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import {
  quotationImportSchema,
  type QuotationImportRow,
} from "@/lib/validations/quotation-import"
import type { ActionResult } from "@/types/actions"

// Lookups with .in() go in the URL, so long lists are split.
const LOOKUP_CHUNK = 100

const batchSchema = z.array(quotationImportSchema).min(1).max(QUOTATION_IMPORT_BATCH_SIZE)

type Client = Awaited<ReturnType<typeof createClient>>

function chunks<T>(values: T[], size = LOOKUP_CHUNK) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

const unique = <T,>(values: T[]) => [...new Set(values)]
const isUuid = (value: string) => z.uuid().safeParse(value).success

// The customers these rows belong to: by Customer ID (a customer's source ID, or our own
// ID from an export), else by exact display name.
async function loadCustomers(supabase: Client, rows: QuotationImportRow[]) {
  const byExternalId = new Map<string, string>()
  const byId = new Set<string>()
  const byName = new Map<string, string>()

  const ids = unique(rows.flatMap((row) => (row.customerExternalId ? [row.customerExternalId] : [])))
  for (const part of chunks(ids)) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, external_id")
      .in("external_id", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const customer of data) {
      if (customer.external_id) byExternalId.set(customer.external_id, customer.id)
    }
  }
  for (const part of chunks(ids.filter(isUuid))) {
    const { data, error } = await supabase.from("customers").select("id").in("id", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const customer of data) byId.add(customer.id)
  }
  for (const part of chunks(unique(rows.map((row) => row.customerName)))) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, display_name")
      .in("display_name", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const customer of data) byName.set(customer.display_name, customer.id)
  }

  return (row: QuotationImportRow) => {
    const id = row.customerExternalId
    if (id && byExternalId.has(id)) return byExternalId.get(id)
    if (id && byId.has(id)) return id
    return byName.get(row.customerName)
  }
}

// The item each line came from: by Product ID (an item's source ID, or our own ID from an
// export), else by exact name. A line with no item stays a typed line.
async function loadItems(supabase: Client, rows: QuotationImportRow[]) {
  const lines = rows.flatMap((row) => row.lines)
  const ids = unique(lines.flatMap((line) => (line.itemExternalId ? [line.itemExternalId] : [])))
  const byExternalId = new Map<string, string>()
  const byId = new Set<string>()
  const byName = new Map<string, string>()

  for (const part of chunks(ids)) {
    const { data, error } = await supabase
      .from("items")
      .select("id, external_id")
      .in("external_id", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const item of data) if (item.external_id) byExternalId.set(item.external_id, item.id)
  }
  for (const part of chunks(ids.filter(isUuid))) {
    const { data, error } = await supabase.from("items").select("id").in("id", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const item of data) byId.add(item.id)
  }
  for (const part of chunks(unique(lines.map((line) => line.name)))) {
    const { data, error } = await supabase.from("items").select("id, name").in("name", part)
    if (error) throw new Error(getDatabaseErrorMessage(error))
    for (const item of data) byName.set(item.name, item.id)
  }

  return (line: QuotationImportRow["lines"][number]) => {
    const id = line.itemExternalId
    if (id && byExternalId.has(id)) return byExternalId.get(id) ?? null
    if (id && byId.has(id)) return id
    return byName.get(line.name) ?? null
  }
}

// Imports one batch of quotations read from a CSV (see features/quotations/quotation-csv.ts).
// Each goes in on its own through public.save_quotation, with its totals worked out here
// like a saved quote. A number that already exists is skipped, so importing a file again
// changes nothing.
export async function importQuotations(
  rows: QuotationImportRow[]
): Promise<ActionResult<CsvImportResult>> {
  const parsed = batchSchema.safeParse(rows)
  if (!parsed.success) {
    return { success: false, error: "The file has rows that can't be read. Please check it and try again." }
  }

  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "quotations", "create")) {
    return { success: false, error: "You don't have permission to do that." }
  }

  const supabase = await createClient()
  const result: CsvImportResult = { created: 0, updated: 0, skipped: 0, failed: [] }

  try {
    const { data: taxes, error: taxError } = await supabase.from("tax_rates").select(TAX_RATE_COLUMNS)
    if (taxError) throw new Error(getDatabaseErrorMessage(taxError))
    const taxByName = new Map(taxes.map((tax) => [tax.name.trim().toLowerCase(), tax]))

    const customerFor = await loadCustomers(supabase, parsed.data)
    const itemFor = await loadItems(supabase, parsed.data)

    for (const quote of parsed.data) {
      const fail = (message: string, row = quote.row) =>
        result.failed.push({ row, name: quote.quoteNumber, message })

      const customerId = customerFor(quote)
      if (!customerId) {
        fail(`Customer "${quote.customerName}" isn't in Customers`)
        continue
      }

      // A tax that can't be found would quietly change the total, so the quote waits.
      const missingTax = quote.lines.find(
        (line) => line.taxName && !taxByName.has(line.taxName.trim().toLowerCase())
      )
      if (missingTax) {
        fail(`Tax "${missingTax.taxName}" isn't in Settings → Taxes`, missingTax.row)
        continue
      }

      const lines = quote.lines.map((line) => ({
        quantity: line.quantity,
        rate: line.rate,
        discountValue: line.discountValue,
        discountIsPercent: line.discountIsPercent,
        taxId: line.taxName ? (taxByName.get(line.taxName.trim().toLowerCase())?.id ?? null) : null,
      }))
      const totals = computeQuotationTotals({
        lines,
        discountLevel: quote.discountLevel,
        discountValue: quote.discountValue,
        discountIsPercent: quote.discountIsPercent,
        isDiscountBeforeTax: quote.isDiscountBeforeTax,
        adjustment: quote.adjustment,
        taxes,
      })

      const { error } = await supabase.rpc("save_quotation", {
        target_id: null,
        quotation: {
          quote_number: quote.quoteNumber,
          reference_number: quote.referenceNumber,
          customer_id: customerId,
          quote_date: quote.quoteDate,
          expiry_date: quote.expiryDate,
          salesperson_id: null,
          subject: quote.subject,
          price_list_id: null,
          place_of_supply: quote.placeOfSupply,
          discount_level: quote.discountLevel,
          discount_value: quote.discountLevel === "Transaction" ? quote.discountValue : 0,
          discount_is_percent: quote.discountIsPercent,
          is_discount_before_tax: quote.isDiscountBeforeTax,
          adjustment: quote.adjustment,
          adjustment_description: quote.adjustmentDescription,
          notes: quote.notes,
          terms: quote.terms,
          status: quote.status,
          sub_total: totals.subTotal,
          discount_total: totals.discountTotal,
          tax_total: totals.taxTotal,
          total: totals.total,
          tax_deduction_type: "TDS",
          direct_tax_id: null,
          direct_tax_amount: 0,
        },
        items: quote.lines.map((line, index) => ({
          item_id: itemFor(line),
          name: line.name,
          description: line.description,
          hsn_code: line.hsnCode,
          unit: line.unit,
          quantity: line.quantity,
          rate: line.rate,
          discount_value: quote.discountLevel === "Line Item" ? line.discountValue : 0,
          discount_is_percent: line.discountIsPercent,
          price_list_id: null,
          tax_id: lines[index].taxId,
          amount: totals.lineAmounts[index],
        })),
      })

      if (!error) result.created += 1
      else if (error.code === "23505") result.skipped += 1
      else fail(getDatabaseErrorMessage(error))
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
