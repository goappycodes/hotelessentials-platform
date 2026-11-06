"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import type { PermissionAction } from "@/constants/permissions"
import {
  MAX_QUOTATION_ATTACHMENT_BYTES,
  MAX_QUOTATION_ATTACHMENTS,
  QUOTATION_ATTACHMENTS_BUCKET,
} from "@/constants/quotations"
import { QUOTATION_STATUSES, QUOTATIONS_LIST } from "@/features/quotations/list-config"
import {
  getQuotationDocument,
  QUOTE_CUSTOMER_COLUMNS,
  type QuotationDocumentData,
  type QuoteCustomer,
} from "@/features/quotations/queries"
import { TAX_RATE_COLUMNS } from "@/features/taxes/tax-rates"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { applyPriceAdjustment } from "@/lib/price-lists"
import { computeQuotationTotals } from "@/lib/quotations"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import {
  MAX_QUOTATION_LINES,
  quotationSchema,
  type QuotationInput,
} from "@/lib/validations/quotation"
import type { ActionResult } from "@/types/actions"

const INVALID_INPUT = "Please check the form and try again."
const NOT_ALLOWED = "You don't have permission to do that."

const statusSchema = z.enum(QUOTATION_STATUSES)
type QuotationStatus = z.infer<typeof statusSchema>

async function authorize(action: PermissionAction) {
  const session = await fetchSession()
  if (!session?.user.isActive) return null
  return hasAccess(session, "quotations", action) ? session : null
}

// The customer and item pickers also serve the sales order form.
async function canUsePickers() {
  const session = await fetchSession()
  if (!session?.user.isActive) return false
  return (
    hasAccess(session, "quotations", "create") ||
    hasAccess(session, "quotations", "edit") ||
    hasAccess(session, "sales_orders", "create")
  )
}

function getQuotationErrorMessage(error: PostgrestError) {
  if (error.code === "23505") return "Another quotation already uses this quote number."
  if (error.code === "P0002") return "This quotation no longer exists."
  if (error.message.includes("valid_expiry")) return "The expiry date can't be before the quote date."
  // Messages written for users by save_quotation ("Add at least one item." …).
  if (["23514", "23503"].includes(error.code) && !error.message.includes("violates")) {
    return error.message
  }
  return getDatabaseErrorMessage(error)
}

const num = (value: string) => Number(value || 0)
const orNull = (value: string) => value.trim() || null

// Creates a quotation (quotationId null) or updates one, with its lines, in one database
// transaction. Totals are worked out here from the lines, so they can't be tampered with.
// status: the status to save with (new quotes: Draft or Sent); null keeps the current one.
export async function saveQuotation(
  quotationId: string | null,
  input: QuotationInput,
  status: QuotationStatus | null
): Promise<ActionResult<{ id: string }>> {
  const id = quotationId === null ? null : z.uuid().safeParse(quotationId)
  const parsed = quotationSchema.safeParse(input)
  const parsedStatus = status === null ? null : statusSchema.safeParse(status)
  if (!parsed.success || (id && !id.success) || (parsedStatus && !parsedStatus.success)) {
    return { success: false, error: INVALID_INPUT }
  }
  if (!(await authorize(id ? "edit" : "create"))) return { success: false, error: NOT_ALLOWED }

  const quote = parsed.data
  const supabase = await createClient()
  const [{ data: taxes, error: taxError }, directTaxResult] = await Promise.all([
    supabase.from("tax_rates").select(TAX_RATE_COLUMNS),
    quote.directTaxId
      ? supabase
          .from("direct_tax_rates")
          .select("kind, rate")
          .eq("id", quote.directTaxId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (taxError) return { success: false, error: getDatabaseErrorMessage(taxError) }
  // TDS or TCS, worked out with the rate as it is now.
  const directTax = directTaxResult.data
  if (quote.directTaxId && (!directTax || directTax.kind !== quote.taxDeductionType)) {
    return { success: false, error: `Pick the ${quote.taxDeductionType} rate again.` }
  }

  const lines = quote.lines.map((line) => ({
    quantity: num(line.quantity),
    rate: num(line.rate),
    discountValue: num(line.discountValue),
    discountIsPercent: line.discountIsPercent,
    taxId: line.taxId || null,
  }))
  const totals = computeQuotationTotals({
    lines,
    discountLevel: quote.discountLevel,
    discountValue: num(quote.discountValue),
    discountIsPercent: quote.discountIsPercent,
    isDiscountBeforeTax: quote.isDiscountBeforeTax,
    adjustment: num(quote.adjustment),
    taxes,
    directTax,
  })

  const { data, error } = await supabase.rpc("save_quotation", {
    target_id: id ? id.data : null,
    quotation: {
      quote_number: orNull(quote.quoteNumber),
      reference_number: orNull(quote.referenceNumber),
      customer_id: quote.customerId,
      quote_date: quote.quoteDate,
      expiry_date: quote.expiryDate || null,
      salesperson_id: quote.salespersonId || null,
      subject: orNull(quote.subject),
      price_list_id: quote.priceListId || null,
      place_of_supply: quote.placeOfSupply || null,
      discount_level: quote.discountLevel,
      discount_value: quote.discountLevel === "Transaction" ? num(quote.discountValue) : 0,
      discount_is_percent: quote.discountIsPercent,
      is_discount_before_tax: quote.isDiscountBeforeTax,
      adjustment: num(quote.adjustment),
      adjustment_description: orNull(quote.adjustmentDescription),
      notes: orNull(quote.notes),
      terms: orNull(quote.terms),
      status: parsedStatus?.data ?? null,
      sub_total: totals.subTotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      total: totals.total,
      tax_deduction_type: quote.taxDeductionType,
      direct_tax_id: quote.directTaxId || null,
      direct_tax_amount: totals.directTaxAmount,
    },
    items: quote.lines.map((line, index) => ({
      item_id: line.itemId || null,
      name: line.name,
      description: orNull(line.description),
      hsn_code: orNull(line.hsnCode),
      unit: orNull(line.unit),
      quantity: lines[index].quantity,
      rate: lines[index].rate,
      // Line discounts only count at line level.
      discount_value: quote.discountLevel === "Line Item" ? lines[index].discountValue : 0,
      discount_is_percent: line.discountIsPercent,
      price_list_id: line.itemId && line.priceListId ? line.priceListId : null,
      tax_id: lines[index].taxId,
      amount: totals.lineAmounts[index],
    })),
  })
  if (error) return { success: false, error: getQuotationErrorMessage(error) }
  return { success: true, data: { id: data } }
}

export async function setQuotationStatus(
  quotationId: string,
  status: QuotationStatus
): Promise<ActionResult> {
  const id = z.uuid().safeParse(quotationId)
  const parsedStatus = statusSchema.safeParse(status)
  if (!id.success || !parsedStatus.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("quotations")
    .update({ status: parsedStatus.data })
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getQuotationErrorMessage(error) }
  if (!data) return { success: false, error: "This quotation no longer exists." }
  return { success: true, data: undefined }
}

export async function deleteQuotation(quotationId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(quotationId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("delete"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data: files } = await supabase
    .from("quotation_attachments")
    .select("storage_path")
    .eq("quotation_id", id.data)
  const { data, error } = await supabase
    .from("quotations")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getQuotationErrorMessage(error) }
  if (!data) return { success: false, error: "This quotation no longer exists." }
  // Its attachment rows went with it; the stored files are removed here.
  if (files?.length) {
    await supabase.storage
      .from(QUOTATION_ATTACHMENTS_BUCKET)
      .remove(files.map((file) => file.storage_path))
  }
  return { success: true, data: undefined }
}

// The opened quotation beside the list (loaded in the browser, like items).
export async function getQuotationDetail(
  quotationId: string
): Promise<QuotationDocumentData | null> {
  const id = z.uuid().safeParse(quotationId)
  if (!id.success || !(await authorize("view"))) return null
  return getQuotationDocument(await createClient(), id.data)
}

const uploadedAttachmentsSchema = z
  .array(
    z.object({
      storagePath: z.string().min(1).max(300),
      fileName: z.string().trim().min(1).max(200),
      contentType: z.string().max(200),
      fileSize: z.number().int().positive().max(MAX_QUOTATION_ATTACHMENT_BYTES),
    })
  )
  .min(1)
  .max(MAX_QUOTATION_ATTACHMENTS)

// Records files the browser has already uploaded to storage under `<quotationId>/`.
export async function addQuotationAttachments(
  quotationId: string,
  files: z.infer<typeof uploadedAttachmentsSchema>
): Promise<ActionResult> {
  const id = z.uuid().safeParse(quotationId)
  const parsed = uploadedAttachmentsSchema.safeParse(files)
  if (!id.success || !parsed.success) return { success: false, error: INVALID_INPUT }
  if (parsed.data.some((file) => !file.storagePath.startsWith(`${id.data}/`))) {
    return { success: false, error: INVALID_INPUT }
  }
  const session = await fetchSession()
  if (
    !session?.user.isActive ||
    !(hasAccess(session, "quotations", "create") || hasAccess(session, "quotations", "edit"))
  ) {
    return { success: false, error: NOT_ALLOWED }
  }

  const supabase = await createClient()
  const { count } = await supabase
    .from("quotation_attachments")
    .select("id", { count: "exact", head: true })
    .eq("quotation_id", id.data)
  if ((count ?? 0) + parsed.data.length > MAX_QUOTATION_ATTACHMENTS) {
    return {
      success: false,
      error: `A quotation can have at most ${MAX_QUOTATION_ATTACHMENTS} files.`,
    }
  }

  const { error } = await supabase.from("quotation_attachments").insert(
    parsed.data.map((file) => ({
      quotation_id: id.data,
      storage_path: file.storagePath,
      file_name: file.fileName,
      content_type: file.contentType || null,
      file_size: file.fileSize,
    }))
  )
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  return { success: true, data: undefined }
}

export async function removeQuotationAttachment(attachmentId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(attachmentId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("quotation_attachments")
    .delete()
    .eq("id", id.data)
    .select("storage_path")
    .maybeSingle()
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  if (data) await supabase.storage.from(QUOTATION_ATTACHMENTS_BUCKET).remove([data.storage_path])
  return { success: true, data: undefined }
}

const countFiltersSchema = z.record(z.string(), z.string())

// "Total Count: View" on the quotations list. Same filters and search as the list.
export async function countQuotations(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  if (!parsed.success || !(await authorize("view"))) throw new Error(NOT_ALLOWED)

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("quotations").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, QUOTATIONS_LIST)
  )
  if (error) throw new Error("Failed to count quotations")
  return count ?? 0
}

export type QuoteItemOption = {
  id: string
  name: string
  sku: string | null
  unit: string | null
  hsnCode: string | null
  description: string | null
  sellingPrice: number
  // The price on the quotation's default price list (the selling price without one).
  rate: number
  intraTaxId: string | null
  interTaxId: string | null
  isTaxable: boolean
}

const itemSearchSchema = z.object({
  term: z.string().trim().max(100),
  priceListId: z.union([z.uuid(), z.literal("")]),
  offset: z.number().int().min(0).max(100000),
})

// The item picker shows this many at a time, and the next batch as you scroll.
const ITEM_SEARCH_PAGE_SIZE = 10

export type QuoteItemPage = {
  items: QuoteItemOption[]
  hasMore: boolean
  // The one item whose whole name, SKU or HSN code is what was typed (or pasted), so the
  // picker can choose it without a click. Null when none or several match.
  exactMatch: QuoteItemOption | null
}

const NO_ITEMS: QuoteItemPage = { items: [], hasMore: false, exactMatch: null }

const QUOTE_ITEM_COLUMNS =
  "id, name, sku, unit, hsn_code, sales_description, selling_price, intra_state_tax_id, inter_state_tax_id, tax_preference" as const

// Items for the quotation's item picker: active, sold items matching the name, SKU or
// HSN code, priced with the quotation's price list when it has one. `offset` pages
// through them, ITEM_SEARCH_PAGE_SIZE at a time.
export async function searchQuoteItems(
  term: string,
  priceListId: string,
  offset = 0
): Promise<QuoteItemPage> {
  const parsed = itemSearchSchema.safeParse({ term, priceListId, offset })
  if (!parsed.success) return NO_ITEMS
  if (!(await canUsePickers())) return NO_ITEMS

  const supabase = await createClient()
  // Anything may sit between words, so "PAN GREY" finds "PAN (GREY)".
  const words = parsed.data.term.replace(/[%_,()]/g, " ").trim().replace(/\s+/g, "%")
  let query = supabase
    .from("item_list")
    .select(QUOTE_ITEM_COLUMNS)
    .eq("is_active", true)
    .eq("sales_enabled", true)
    .order("name")
    .order("id")
    // One extra row tells whether there are more.
    .range(parsed.data.offset, parsed.data.offset + ITEM_SEARCH_PAGE_SIZE)
  if (words) {
    query = query.or(`name.ilike.%${words}%,sku.ilike.%${words}%,hsn_code.ilike.%${words}%`)
  }

  const [{ data: rows, error }, exact] = await Promise.all([
    query,
    parsed.data.offset === 0 ? findExactItem(supabase, parsed.data.term) : Promise.resolve(null),
  ])
  if (error || !rows) return NO_ITEMS
  const hasMore = rows.length > ITEM_SEARCH_PAGE_SIZE
  const items = rows.slice(0, ITEM_SEARCH_PAGE_SIZE)
  const listRates = await priceItemsFromList(
    supabase,
    parsed.data.priceListId,
    exact ? [...items, exact] : items
  )
  const toOption = (item: (typeof items)[number]): QuoteItemOption => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    hsnCode: item.hsn_code,
    description: item.sales_description,
    sellingPrice: item.selling_price,
    rate: listRates.get(item.id) ?? item.selling_price,
    intraTaxId: item.intra_state_tax_id,
    interTaxId: item.inter_state_tax_id,
    isTaxable: item.tax_preference === "Taxable",
  })

  return {
    hasMore,
    items: items.map(toOption),
    exactMatch: exact ? toOption(exact) : null,
  }
}

// The one active, sold item whose whole name or SKU (any case) or HSN code is the term.
async function findExactItem(supabase: Awaited<ReturnType<typeof createClient>>, term: string) {
  const text = term.trim()
  if (!text) return null
  // ilike without wildcards is a case-insensitive "equals"; escape the term's own.
  const pattern = text.replace(/[\\%_]/g, (character) => `\\${character}`)
  const base = () =>
    supabase
      .from("item_list")
      .select(QUOTE_ITEM_COLUMNS)
      .eq("is_active", true)
      .eq("sales_enabled", true)
      .limit(2)
  const results = await Promise.all([
    base().ilike("name", pattern),
    base().ilike("sku", pattern),
    base().eq("hsn_code", text),
  ])
  const matches = new Map(
    results.flatMap((result) => result.data ?? []).map((item) => [item.id, item])
  )
  return matches.size === 1 ? [...matches.values()][0] : null
}

// Each item's price on a sales price list: marked up or down for "All Items" lists, or
// its custom rate on "Individual Items" lists (its selling price when it has none).
async function priceItemsFromList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  priceListId: string,
  items: { id: string; selling_price: number }[]
) {
  const rates = new Map(items.map((item) => [item.id, item.selling_price]))
  if (!priceListId || items.length === 0) return rates

  const { data: list } = await supabase
    .from("price_lists")
    .select("price_list_type, percentage_type, percentage_value, round_off_to, decimal_places, transaction_type")
    .eq("id", priceListId)
    .maybeSingle()
  if (!list || list.transaction_type !== "Sales") return rates

  if (list.price_list_type === "Individual Items") {
    const { data: custom } = await supabase
      .from("price_list_items")
      .select("item_id, rate")
      .eq("price_list_id", priceListId)
      .in(
        "item_id",
        items.map((item) => item.id)
      )
    for (const entry of custom ?? []) rates.set(entry.item_id, entry.rate)
    return rates
  }

  if (list.percentage_type && list.percentage_value !== null) {
    for (const item of items) {
      rates.set(
        item.id,
        applyPriceAdjustment(item.selling_price, {
          percentageType: list.percentage_type,
          percentageValue: list.percentage_value,
          roundOffTo: list.round_off_to,
          decimalPlaces: list.decimal_places,
        })
      )
    }
  }
  return rates
}

export type QuoteCustomerPage = { customers: QuoteCustomer[]; hasMore: boolean }

const customerSearchSchema = z.object({
  term: z.string().trim().max(100),
  offset: z.number().int().min(0).max(100000),
})

// Active customers for the quotation's customer box, matching the name, company or GSTIN.
// `offset` pages through them, ITEM_SEARCH_PAGE_SIZE at a time.
export async function searchQuoteCustomers(term: string, offset = 0): Promise<QuoteCustomerPage> {
  const parsed = customerSearchSchema.safeParse({ term, offset })
  const none: QuoteCustomerPage = { customers: [], hasMore: false }
  if (!parsed.success) return none
  if (!(await canUsePickers())) return none

  const supabase = await createClient()
  // Anything may sit between words, so "PAN GREY" finds "PAN (GREY)".
  const words = parsed.data.term.replace(/[%_,()]/g, " ").trim().replace(/\s+/g, "%")
  let query = supabase
    .from("customers")
    .select(QUOTE_CUSTOMER_COLUMNS)
    .eq("is_active", true)
    .order("display_name")
    .order("id")
    // One extra row tells whether there are more.
    .range(parsed.data.offset, parsed.data.offset + ITEM_SEARCH_PAGE_SIZE)
  if (words) {
    query = query.or(
      `display_name.ilike.%${words}%,company_name.ilike.%${words}%,gstin.ilike.%${words}%`
    )
  }

  const { data, error } = await query
  if (error || !data) return none
  return {
    customers: data.slice(0, ITEM_SEARCH_PAGE_SIZE),
    hasMore: data.length > ITEM_SEARCH_PAGE_SIZE,
  }
}

const linePricesSchema = z.object({
  priceListId: z.union([z.uuid(), z.literal("")]),
  itemIds: z.array(z.uuid()).min(1).max(MAX_QUOTATION_LINES),
})

export type LinePrice = { sellingPrice: number; listRate: number }

// Prices for quote lines when their price list changes: each item's selling price and its
// price on the list (the same when there is no list).
export async function getLinePrices(
  priceListId: string,
  itemIds: string[]
): Promise<Record<string, LinePrice>> {
  const parsed = linePricesSchema.safeParse({ priceListId, itemIds: [...new Set(itemIds)] })
  if (!parsed.success) return {}
  if (!(await canUsePickers())) return {}

  const supabase = await createClient()
  const { data: items } = await supabase
    .from("item_list")
    .select("id, selling_price")
    .in("id", parsed.data.itemIds)
  if (!items?.length) return {}
  const listRates = await priceItemsFromList(supabase, parsed.data.priceListId, items)
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      { sellingPrice: item.selling_price, listRate: listRates.get(item.id) ?? item.selling_price },
    ])
  )
}
