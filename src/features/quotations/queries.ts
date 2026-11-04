import "server-only"

import { QUOTATION_ATTACHMENTS_BUCKET } from "@/constants/quotations"
import type { QuotationAttachmentView } from "@/features/quotations/components/quotation-attachments-field"
import { TAX_RATE_COLUMNS } from "@/features/taxes/tax-rates"
import type { createRequestClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createRequestClient>>

// Supabase returns at most this many rows per request.
const PAGE_SIZE = 1000

// Every customer for the customer picker (read page by page), with what the quotation
// takes from them: place of supply, price list and GST details.
async function getCustomerOptions(supabase: Client) {
  const customers = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, display_name, company_name, email, gstin, gst_treatment, place_of_supply, price_list_id, is_active")
      .order("display_name")
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error("Failed to load customers")
    customers.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return customers
}

// Everything the quotation form picks from.
export async function getQuotationFormOptions(supabase: Client) {
  const [customers, salespeople, priceLists, taxes, settings] = await Promise.all([
    getCustomerOptions(supabase),
    supabase.from("profiles").select("id, first_name, last_name, is_active").order("first_name"),
    supabase
      .from("price_lists")
      .select("id, name, is_active")
      .eq("transaction_type", "Sales")
      .order("name"),
    supabase.from("tax_rates").select(TAX_RATE_COLUMNS).order("rate"),
    supabase.from("organization_settings").select("gst_state_code").maybeSingle(),
  ])
  if (salespeople.error || taxes.error) throw new Error("Failed to load the quotation form")

  return {
    customers,
    salespeople: salespeople.data.map((person) => ({
      id: person.id,
      name: [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unnamed user",
      isActive: person.is_active,
    })),
    // Price lists the user can't view are simply not offered.
    priceLists: priceLists.data ?? [],
    taxes: taxes.data,
    businessState: settings.data?.gst_state_code ?? null,
  }
}

export type QuotationFormOptions = Awaited<ReturnType<typeof getQuotationFormOptions>>

const SIGNED_URL_SECONDS = 60 * 60

const DOCUMENT_CUSTOMER_COLUMNS =
  "display_name, company_name, gstin, billing_attention, billing_street1, billing_street2, billing_city, billing_state, billing_pin_code, billing_country, billing_phone" as const

const DOCUMENT_COMPANY_COLUMNS =
  "company_name, address, phone, email, gstin, bank_details, gst_state_code" as const

// Everything the quote document shows: the quotation and its lines (with how each line's
// GST splits), the customer's billing details, the business's own details and the files.
export async function getQuotationDocument(supabase: Client, quotationId: string) {
  const [quoteResult, linesResult, companyResult, attachments] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", quotationId).maybeSingle(),
    supabase
      .from("quotation_items")
      .select("*, tax:tax_rates(tax_scope, cgst_rate, sgst_rate, igst_rate)")
      .eq("quotation_id", quotationId)
      .order("sort_order"),
    supabase.from("organization_settings").select(DOCUMENT_COMPANY_COLUMNS).maybeSingle(),
    getQuotationAttachments(supabase, quotationId),
  ])
  if (quoteResult.error || linesResult.error) throw new Error("Failed to load the quotation")
  const quote = quoteResult.data
  if (!quote) return null

  const [customerResult, salespersonResult] = await Promise.all([
    supabase.from("customers").select(DOCUMENT_CUSTOMER_COLUMNS).eq("id", quote.customer_id).maybeSingle(),
    quote.salesperson_id
      ? supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", quote.salesperson_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const salesperson = salespersonResult.data

  return {
    quote,
    lines: linesResult.data,
    customer: customerResult.data,
    company: companyResult.data,
    salespersonName: salesperson
      ? [salesperson.first_name, salesperson.last_name].filter(Boolean).join(" ") || null
      : null,
    attachments,
  }
}

export type QuotationDocumentData = NonNullable<Awaited<ReturnType<typeof getQuotationDocument>>>

// A quotation's attached files, with short-lived links that download them by name.
export async function getQuotationAttachments(
  supabase: Client,
  quotationId: string
): Promise<QuotationAttachmentView[]> {
  const { data, error } = await supabase
    .from("quotation_attachments")
    .select("id, storage_path, file_name, file_size")
    .eq("quotation_id", quotationId)
    .order("created_at")
  if (error) throw new Error("Failed to load the quotation's files")
  if (data.length === 0) return []

  const links = await Promise.all(
    data.map((file) =>
      supabase.storage
        .from(QUOTATION_ATTACHMENTS_BUCKET)
        .createSignedUrl(file.storage_path, SIGNED_URL_SECONDS, { download: file.file_name })
    )
  )
  return data.flatMap((file, index) => {
    const url = links[index].data?.signedUrl
    return url
      ? [{ id: file.id, fileName: file.file_name, fileSize: file.file_size, url }]
      : []
  })
}
