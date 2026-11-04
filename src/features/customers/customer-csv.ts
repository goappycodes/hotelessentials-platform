// Customers as CSV, in Zoho Books' contacts export format, so a Zoho export can be
// imported and our exports can be imported again (or into Zoho). Pure functions: used by
// the import in the browser and the export Route Handler on the server.

import {
  GST_TREATMENTS,
  INDIAN_STATES,
  PAYMENT_TERMS,
  type GstTreatment,
} from "@/constants/customers"
import { parseCsv } from "@/lib/csv"
import { columnFinder, type CsvReadResult, type ImportProblem } from "@/lib/csv-import"
import {
  customerImportRowSchema,
  type CustomerImportRow,
} from "@/lib/validations/customer-import"
import type { Tables } from "@/types/database"

// Columns written by the export, in order (Zoho's names). The import reads these names
// (and the aliases below, any case); the rest of a Zoho export is ignored.
export const CUSTOMER_CSV_COLUMNS = [
  "Contact ID",
  "Display Name",
  "Company Name",
  "Salutation",
  "First Name",
  "Last Name",
  "EmailID",
  "Phone",
  "MobilePhone",
  "Contact Type",
  "Customer Sub Type",
  "Status",
  "Currency Code",
  "Opening Balance",
  "Payment Terms Label",
  "Price List",
  "GST Treatment",
  "GST Identification Number (GSTIN)",
  "PAN Number",
  "Place of Contact(With State Code)",
  "Taxable",
  "Exemption Reason",
  "Billing Attention",
  "Billing Address",
  "Billing Street2",
  "Billing City",
  "Billing State",
  "Billing Country",
  "Billing Code",
  "Billing Phone",
  "Billing Fax",
  "Shipping Attention",
  "Shipping Address",
  "Shipping Street2",
  "Shipping City",
  "Shipping State",
  "Shipping Country",
  "Shipping Code",
  "Shipping Phone",
  "Shipping Fax",
  "Notes",
] as const

type Column = (typeof CUSTOMER_CSV_COLUMNS)[number]

const COLUMN_ALIASES: Partial<Record<Column, readonly string[]>> = {
  "Display Name": ["Customer Name", "Name"],
  EmailID: ["Email", "Email Address"],
  Phone: ["Work Phone"],
  MobilePhone: ["Mobile"],
  "Customer Sub Type": ["Customer Type"],
  "Payment Terms Label": ["Payment Terms"],
  "GST Identification Number (GSTIN)": ["GSTIN"],
  "PAN Number": ["PAN"],
  "Place of Contact(With State Code)": ["Place of Supply"],
  "Billing Code": ["Billing Pin Code"],
  "Shipping Code": ["Shipping Pin Code"],
  Notes: ["Remarks"],
}

// The only column a file must have.
const REQUIRED_COLUMNS = ["Display Name"] as const

// Zoho's GST treatment codes, and the names this app uses.
const ZOHO_GST_TREATMENTS: Record<string, GstTreatment> = {
  business_gst: "Registered Business - Regular",
  business_registered_regular: "Registered Business - Regular",
  business_registered_composition: "Registered Business - Composition",
  business_none: "Unregistered Business",
  consumer: "Consumer",
  overseas: "Overseas",
  business_sez: "Special Economic Zone",
  deemed_export: "Deemed Export",
  tax_deductor: "Tax Deductor",
  sez_developer: "SEZ Developer",
}

// For the export: the code Zoho writes for each treatment (the first one listed above).
const GST_TREATMENT_CODES = Object.fromEntries(
  Object.entries(ZOHO_GST_TREATMENTS)
    .reverse()
    .map(([code, name]) => [name, code])
) as Record<GstTreatment, string>

const FIELD_LABELS: Partial<Record<keyof CustomerImportRow, string>> = {
  display_name: "Display Name",
  email: "Email",
  work_phone: "Phone",
  mobile: "Mobile phone",
  gstin: "GSTIN",
  pan: "PAN",
  place_of_supply: "Place of supply",
  exemption_reason: "Exemption reason",
  opening_balance: "Opening balance",
  billing_phone: "Billing phone",
  billing_fax: "Billing fax",
  shipping_phone: "Shipping phone",
  shipping_fax: "Shipping fax",
}

const normalize = (value: string) => value.trim().toLowerCase()

// Blank → null. Excel's leading ' (marks a cell as text, e.g. '+91-98300…) is dropped.
const text = (value: string) => value.trim().replace(/^'+/, "").trim() || null

function parseAmount(value: string) {
  const amount = value.replace(/INR|₹|,|\s/gi, "")
  if (!amount) return 0
  if (!/^\d+(\.\d+)?$/.test(amount)) return Number.NaN
  return Math.round(Number(amount) * 10_000) / 10_000
}

function toGstTreatment(value: string): GstTreatment | null {
  const key = normalize(value)
  if (!key) return null
  return (
    ZOHO_GST_TREATMENTS[key] ??
    GST_TREATMENTS.find((treatment) => normalize(treatment) === key) ??
    null
  )
}

// "19-West Bengal", "19", "WB" or "West Bengal" → "19".
function toStateCode(value: string) {
  const key = normalize(value)
  if (!key) return null
  const leading = key.match(/^(\d{2})\b/)?.[1]
  const state = INDIAN_STATES.find(
    (entry) =>
      entry.code === leading ||
      entry.short.toLowerCase() === key ||
      entry.name.toLowerCase() === key ||
      entry.code === key
  )
  return state?.code ?? null
}

// A blank country with an Indian state is India.
function toCountry(country: string, state: string) {
  const given = text(country)
  if (given) return given
  return INDIAN_STATES.some((entry) => normalize(entry.name) === normalize(state)) ? "India" : null
}

// Reads a CSV file into customers to import, with a list of rows that can't be imported.
export function readCustomerCsv(content: string): CsvReadResult<CustomerImportRow> {
  const [header = [], ...records] = parseCsv(content)
  const find = columnFinder(header)
  const indexOf = (column: Column) => find([column, ...(COLUMN_ALIASES[column] ?? [])])

  const missingColumns = REQUIRED_COLUMNS.filter((column) => indexOf(column) === undefined)
  if (missingColumns.length) {
    return { rows: [], problems: [], missingColumns, totalRows: records.length }
  }
  const positions = Object.fromEntries(
    CUSTOMER_CSV_COLUMNS.map((column) => [column, indexOf(column)])
  ) as Record<Column, number | undefined>

  const rows: CustomerImportRow[] = []
  const problems: ImportProblem[] = []
  const seenIds = new Map<string, number>()

  records.forEach((record, index) => {
    const row = index + 2
    const get = (column: Column) => {
      const position = positions[column]
      return position === undefined ? "" : (record[position] ?? "").trim()
    }
    const name = get("Display Name")
    const report = (message: string) => problems.push({ row, name, message })

    // Zoho's contacts export can include vendors.
    const contactType = normalize(get("Contact Type"))
    if (contactType && contactType !== "customer") {
      return report(`Is a ${contactType}, not a customer`)
    }

    const openingBalance = parseAmount(get("Opening Balance"))
    if (Number.isNaN(openingBalance)) {
      return report(`Opening Balance "${get("Opening Balance")}" isn't an amount`)
    }

    const rawTreatment = get("GST Treatment")
    const gstTreatment = toGstTreatment(rawTreatment)
    if (rawTreatment && !gstTreatment) return report(`GST Treatment "${rawTreatment}" isn't known`)

    const gstin = text(get("GST Identification Number (GSTIN)"))?.toUpperCase() ?? null
    const isTaxable = !["false", "no", "0"].includes(normalize(get("Taxable")))
    const paymentTerms =
      PAYMENT_TERMS.find((terms) => normalize(terms) === normalize(get("Payment Terms Label"))) ??
      "Due on Receipt"

    const candidate = {
      row,
      externalId: text(get("Contact ID")),
      priceListName: text(get("Price List")),
      customer_type: normalize(get("Customer Sub Type")) === "individual" ? "Individual" : "Business",
      salutation: text(get("Salutation")),
      first_name: text(get("First Name")),
      last_name: text(get("Last Name")),
      company_name: text(get("Company Name")),
      display_name: name,
      email: text(get("EmailID")),
      work_phone: text(get("Phone")),
      mobile: text(get("MobilePhone")),
      language: "English",
      gst_treatment: gstTreatment,
      gstin,
      place_of_supply:
        gstTreatment === "Overseas"
          ? null
          : (toStateCode(get("Place of Contact(With State Code)")) ??
            (gstin ? toStateCode(gstin.slice(0, 2)) : null)),
      pan: text(get("PAN Number"))?.toUpperCase() ?? null,
      tax_preference: isTaxable ? "Taxable" : "Tax Exempt",
      exemption_reason: isTaxable ? null : text(get("Exemption Reason")),
      opening_balance: openingBalance,
      payment_terms: paymentTerms,
      billing_attention: text(get("Billing Attention")),
      billing_country: toCountry(get("Billing Country"), get("Billing State")),
      billing_street1: text(get("Billing Address")),
      billing_street2: text(get("Billing Street2")),
      billing_city: text(get("Billing City")),
      billing_state: text(get("Billing State")),
      billing_pin_code: text(get("Billing Code")),
      billing_phone: text(get("Billing Phone")),
      billing_fax: text(get("Billing Fax")),
      shipping_attention: text(get("Shipping Attention")),
      shipping_country: toCountry(get("Shipping Country"), get("Shipping State")),
      shipping_street1: text(get("Shipping Address")),
      shipping_street2: text(get("Shipping Street2")),
      shipping_city: text(get("Shipping City")),
      shipping_state: text(get("Shipping State")),
      shipping_pin_code: text(get("Shipping Code")),
      shipping_phone: text(get("Shipping Phone")),
      shipping_fax: text(get("Shipping Fax")),
      remarks: text(get("Notes")),
      is_active: normalize(get("Status")) !== "inactive",
    }

    const parsed = customerImportRowSchema.safeParse(candidate)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const field = issue?.path[0] as keyof CustomerImportRow | undefined
      return report(`${(field && FIELD_LABELS[field]) ?? "A value"} ${issue?.message ?? "is invalid"}`)
    }

    // A Contact ID repeated within the file: the first row wins.
    if (parsed.data.externalId) {
      const first = seenIds.get(parsed.data.externalId)
      if (first) return report(`Contact ID "${parsed.data.externalId}" is also used on row ${first}`)
      seenIds.set(parsed.data.externalId, row)
    }

    rows.push(parsed.data)
  })

  return { rows, problems, missingColumns: [], totalRows: records.length }
}

// One customer as a row of CUSTOMER_CSV_COLUMNS.
export function toCustomerCsvRow(customer: Tables<"customers">, priceListName: string | null) {
  const state = INDIAN_STATES.find((entry) => entry.code === customer.place_of_supply)
  const values: Record<Column, string | number> = {
    // Imported customers keep their source ID, so re-importing matches them.
    "Contact ID": customer.external_id ?? customer.id,
    "Display Name": customer.display_name,
    "Company Name": customer.company_name ?? "",
    Salutation: customer.salutation ?? "",
    "First Name": customer.first_name ?? "",
    "Last Name": customer.last_name ?? "",
    EmailID: customer.email ?? "",
    Phone: customer.work_phone ?? "",
    MobilePhone: customer.mobile ?? "",
    "Contact Type": "customer",
    "Customer Sub Type": customer.customer_type === "Individual" ? "individual" : "business",
    Status: customer.is_active ? "Active" : "Inactive",
    "Currency Code": "INR",
    "Opening Balance": customer.opening_balance || "",
    "Payment Terms Label": customer.payment_terms,
    "Price List": priceListName ?? "",
    "GST Treatment": customer.gst_treatment ? GST_TREATMENT_CODES[customer.gst_treatment] : "",
    "GST Identification Number (GSTIN)": customer.gstin ?? "",
    "PAN Number": customer.pan ?? "",
    "Place of Contact(With State Code)": state ? `${state.code}-${state.name}` : "",
    Taxable: customer.tax_preference === "Taxable" ? "true" : "false",
    "Exemption Reason": customer.exemption_reason ?? "",
    "Billing Attention": customer.billing_attention ?? "",
    "Billing Address": customer.billing_street1 ?? "",
    "Billing Street2": customer.billing_street2 ?? "",
    "Billing City": customer.billing_city ?? "",
    "Billing State": customer.billing_state ?? "",
    "Billing Country": customer.billing_country ?? "",
    "Billing Code": customer.billing_pin_code ?? "",
    "Billing Phone": customer.billing_phone ?? "",
    "Billing Fax": customer.billing_fax ?? "",
    "Shipping Attention": customer.shipping_attention ?? "",
    "Shipping Address": customer.shipping_street1 ?? "",
    "Shipping Street2": customer.shipping_street2 ?? "",
    "Shipping City": customer.shipping_city ?? "",
    "Shipping State": customer.shipping_state ?? "",
    "Shipping Country": customer.shipping_country ?? "",
    "Shipping Code": customer.shipping_pin_code ?? "",
    "Shipping Phone": customer.shipping_phone ?? "",
    "Shipping Fax": customer.shipping_fax ?? "",
    Notes: customer.remarks ?? "",
  }
  return CUSTOMER_CSV_COLUMNS.map((column) => values[column])
}
