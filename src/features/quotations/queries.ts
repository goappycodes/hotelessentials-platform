import "server-only"

import { ITEM_IMAGES_BUCKET } from "@/constants/items"
import { COMPANY_ASSETS_BUCKET, QUOTATION_ATTACHMENTS_BUCKET } from "@/constants/quotations"
import type { QuotationAttachmentView } from "@/features/quotations/components/quotation-attachments-field"
import { TAX_RATE_COLUMNS } from "@/features/taxes/tax-rates"
import type { createRequestClient } from "@/lib/supabase/server"
import type { Tables } from "@/types/database"

type Client = Awaited<ReturnType<typeof createRequestClient>>

// What a quotation takes from its customer: place of supply, price list and GST details.
export const QUOTE_CUSTOMER_COLUMNS =
  "id, display_name, company_name, email, gstin, gst_treatment, place_of_supply, price_list_id, is_active" as const

export type QuoteCustomer = Pick<
  Tables<"customers">,
  | "id"
  | "display_name"
  | "company_name"
  | "email"
  | "gstin"
  | "gst_treatment"
  | "place_of_supply"
  | "price_list_id"
  | "is_active"
>

// One customer, for a quotation being edited. New ones are searched as you type.
export async function getQuoteCustomer(supabase: Client, customerId: string) {
  const { data } = await supabase
    .from("customers")
    .select(QUOTE_CUSTOMER_COLUMNS)
    .eq("id", customerId)
    .maybeSingle()
  return data
}

// Everything the quotation form picks from.
export async function getQuotationFormOptions(supabase: Client) {
  const [salespeople, priceLists, taxes, settings, directTaxes] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, is_active").order("first_name"),
    supabase
      .from("price_lists")
      .select("id, name, is_active")
      .eq("transaction_type", "Sales")
      .order("name"),
    supabase.from("tax_rates").select(TAX_RATE_COLUMNS).order("rate"),
    supabase.from("organization_settings").select("gst_state_code").maybeSingle(),
    supabase.from("direct_tax_rates").select("id, kind, name, rate, is_active").order("name"),
  ])
  if (salespeople.error || taxes.error) throw new Error("Failed to load the quotation form")

  return {
    salespeople: salespeople.data.map((person) => ({
      id: person.id,
      name: [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unnamed user",
      isActive: person.is_active,
    })),
    // Price lists the user can't view are simply not offered.
    priceLists: priceLists.data ?? [],
    taxes: taxes.data,
    businessState: settings.data?.gst_state_code ?? null,
    // TDS and TCS rates for the totals.
    directTaxes: directTaxes.data ?? [],
  }
}

export type QuotationFormOptions = Awaited<ReturnType<typeof getQuotationFormOptions>>

const SIGNED_URL_SECONDS = 60 * 60

const DOCUMENT_CUSTOMER_COLUMNS =
  "display_name, company_name, gstin, billing_attention, billing_street1, billing_street2, billing_city, billing_state, billing_pin_code, billing_country, billing_phone, shipping_attention, shipping_street1, shipping_street2, shipping_city, shipping_state, shipping_pin_code, shipping_phone" as const

export const DOCUMENT_COMPANY_COLUMNS =
  "company_name, address, address_2, phone, email, gstin, pan, bank_details, gst_state_code, logo_path, signature_path" as const

// Everything the quote document shows: the quotation and its lines (with how each line's
// GST splits), the customer's billing details, the business's own details and the files.
export async function getQuotationDocument(supabase: Client, quotationId: string) {
  const [quoteResult, linesResult, companyResult, attachments, salesOrderResult] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", quotationId).maybeSingle(),
    supabase
      .from("quotation_items")
      .select("*, tax:tax_rates(tax_scope, cgst_rate, sgst_rate, igst_rate), item:items(sku)")
      .eq("quotation_id", quotationId)
      .order("sort_order"),
    supabase.from("organization_settings").select(DOCUMENT_COMPANY_COLUMNS).maybeSingle(),
    getQuotationAttachments(supabase, quotationId),
    // Hidden from anyone who can't view sales orders.
    supabase.from("sales_orders").select("id, so_number").eq("quotation_id", quotationId).maybeSingle(),
  ])
  if (quoteResult.error || linesResult.error) throw new Error("Failed to load the quotation")
  const quote = quoteResult.data
  if (!quote) return null

  return {
    quote,
    attachments,
    salesOrder: salesOrderResult.data,
    ...(await getDocumentDetails(supabase, quote.customer_id, companyResult.data, linesResult.data)),
  }
}

type DocumentCompany = Pick<
  Tables<"organization_settings">,
  | "company_name"
  | "address"
  | "address_2"
  | "phone"
  | "email"
  | "gstin"
  | "pan"
  | "bank_details"
  | "gst_state_code"
  | "logo_path"
  | "signature_path"
>

// What a printed quotation or sales order shows besides its own record: the customer, the
// company details and logo, and each line's item picture.
export async function getDocumentDetails<Line extends { item_id: string | null }>(
  supabase: Client,
  customerId: string,
  company: DocumentCompany | null,
  lines: Line[]
) {
  const itemIds = [...new Set(lines.flatMap((line) => (line.item_id ? [line.item_id] : [])))]
  const companyPaths = [company?.logo_path, company?.signature_path].filter(
    (path): path is string => Boolean(path)
  )

  const [customerResult, itemImagesResult, companyUrls] = await Promise.all([
    supabase.from("customers").select(DOCUMENT_CUSTOMER_COLUMNS).eq("id", customerId).maybeSingle(),
    itemIds.length
      ? supabase
          .from("item_images")
          .select("item_id, storage_path")
          .in("item_id", itemIds)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    signedUrls(supabase, COMPANY_ASSETS_BUCKET, companyPaths),
  ])

  // Each item's first picture, beside its lines.
  const firstImagePath = new Map<string, string>()
  for (const image of itemImagesResult.data ?? []) {
    if (!firstImagePath.has(image.item_id)) firstImagePath.set(image.item_id, image.storage_path)
  }
  const imageUrls = await signedUrls(supabase, ITEM_IMAGES_BUCKET, [...firstImagePath.values()])

  return {
    lines: lines.map((line) => {
      const path = line.item_id ? firstImagePath.get(line.item_id) : undefined
      return { ...line, imageUrl: (path && imageUrls.get(path)) || null }
    }),
    customer: customerResult.data,
    company,
    logoUrl: (company?.logo_path && companyUrls.get(company.logo_path)) || null,
    signatureUrl: (company?.signature_path && companyUrls.get(company.signature_path)) || null,
  }
}

// Short-lived links to files in a private bucket, keyed by path.
async function signedUrls(supabase: Client, bucket: string, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>()
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_SECONDS)
  return new Map(
    (data ?? []).flatMap((entry) =>
      entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : []
    )
  )
}

export type QuotationDocumentData = NonNullable<Awaited<ReturnType<typeof getQuotationDocument>>>

// A quotation's attached files, with short-lived links: one that shows the file, and one
// that downloads it by name.
export async function getQuotationAttachments(
  supabase: Client,
  quotationId: string
): Promise<QuotationAttachmentView[]> {
  const { data, error } = await supabase
    .from("quotation_attachments")
    .select("id, storage_path, file_name, file_size, content_type")
    .eq("quotation_id", quotationId)
    .order("created_at")
  if (error) throw new Error("Failed to load the quotation's files")
  if (data.length === 0) return []

  const links = await Promise.all(
    data.map((file) =>
      supabase.storage
        .from(QUOTATION_ATTACHMENTS_BUCKET)
        .createSignedUrl(file.storage_path, SIGNED_URL_SECONDS)
    )
  )
  return data.flatMap((file, index) => {
    const url = links[index].data?.signedUrl
    return url
      ? [
          {
            id: file.id,
            fileName: file.file_name,
            fileSize: file.file_size,
            contentType: file.content_type,
            url,
            downloadUrl: `${url}&download=${encodeURIComponent(file.file_name)}`,
          },
        ]
      : []
  })
}
