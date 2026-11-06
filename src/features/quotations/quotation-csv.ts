// Quotations as CSV, in the style of Zoho Books' estimates export: one row per line item,
// with the quotation's details repeated on each row. Our exports can be imported again.
// Pure functions: used by the import in the browser and the export Route Handler.

import { INDIAN_STATES } from "@/constants/customers"
import { parseCsv } from "@/lib/csv"
import { columnFinder, type CsvReadResult, type ImportProblem } from "@/lib/csv-import"
import {
  quotationImportSchema,
  type QuotationImportLine,
  type QuotationImportRow,
} from "@/lib/validations/quotation-import"
import type { Enums, Tables } from "@/types/database"

// Columns written by the export, in order. The import reads these names (and the aliases
// below, any case); the rest of a Zoho export is ignored.
export const QUOTATION_CSV_COLUMNS = [
  "Estimate Date",
  "Estimate Number",
  "Estimate Status",
  "Customer ID",
  "Customer Name",
  "Place of Supply",
  "Expiry Date",
  "Reference#",
  "Subject",
  "Discount Type",
  "Is Discount Before Tax",
  "Entity Discount Percent",
  "Entity Discount Amount",
  "Item Name",
  "Product ID",
  "Item Desc",
  "HSN/SAC",
  "Usage unit",
  "Quantity",
  "Item Price",
  "Discount",
  "Discount Amount",
  "Item Tax",
  "Item Tax %",
  "Item Total",
  "SubTotal",
  "Total",
  "Adjustment",
  "Adjustment Description",
  "Notes",
  "Terms & Conditions",
] as const

type Column = (typeof QUOTATION_CSV_COLUMNS)[number]

const COLUMN_ALIASES: Partial<Record<Column, readonly string[]>> = {
  "Estimate Date": ["Quote Date", "Date"],
  "Estimate Number": ["Quote Number", "Quote#", "Estimate#"],
  "Estimate Status": ["Quote Status", "Status"],
  "Expiry Date": ["Expiration Date", "Valid Until"],
  "Reference#": ["Reference Number", "Reference", "PurchaseOrder"],
  "Item Desc": ["Item Description", "Description"],
  "HSN/SAC": ["HSN Code", "HSN"],
  "Usage unit": ["Unit"],
  "Item Price": ["Rate"],
  "Item Tax": ["Tax Name", "Tax"],
  "Terms & Conditions": ["Terms and Conditions", "Terms"],
  Notes: ["Customer Notes"],
}

const REQUIRED_COLUMNS = ["Estimate Number", "Estimate Date", "Customer Name", "Item Name"] as const

type Status = Enums<"quotation_status">

// Zoho's estimate statuses. Expired isn't stored here (it's worked out from the expiry
// date), and an invoiced quote was accepted.
const STATUSES: Record<string, Status> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Sent",
  expired: "Sent",
  accepted: "Accepted",
  invoiced: "Accepted",
  partially_invoiced: "Accepted",
  declined: "Declined",
  rejected: "Declined",
}

const normalize = (value: string) => value.trim().toLowerCase()

// Blank → null. Excel's leading ' (marks a cell as text) is dropped.
export const text = (value: string) => value.trim().replace(/^'+/, "").trim() || null

// "₹1,200.50" → 1200.5, blank → 0, not a number → NaN. Kept to 4 decimals, as stored.
export function parseAmount(value: string) {
  const amount = value.replace(/INR|₹|,|\s/gi, "")
  if (!amount) return 0
  if (!/^-?\d+(\.\d+)?$/.test(amount)) return Number.NaN
  return Math.round(Number(amount) * 10_000) / 10_000
}

// 2026-11-04, 04/11/2026 or 04-11-2026 (day first) → 2026-11-04. Null when it isn't a date.
export function parseDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const dayFirst = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  const [year, month, day] = iso
    ? [iso[1], iso[2], iso[3]]
    : dayFirst
      ? [dayFirst[3], dayFirst[2].padStart(2, "0"), dayFirst[1].padStart(2, "0")]
      : []
  if (!year) return null
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`)
  return date.getUTCDate() === Number(day) ? `${year}-${month}-${day}` : null
}

// "19-West Bengal", "19", "WB", "West Bengal" or "West Bengal (19)" → "19".
function toStateCode(value: string) {
  const key = normalize(value).replace(/\s*\(\d{2}\)$/, "")
  if (!key) return null
  const leading = key.match(/^(\d{2})\b/)?.[1]
  const state = INDIAN_STATES.find(
    (entry) =>
      entry.code === leading ||
      entry.short.toLowerCase() === key ||
      entry.name.toLowerCase() === key
  )
  return state?.code ?? null
}

// A line's discount as a percentage or a rupee amount. "10%" is a percentage. Zoho writes
// percentages with no sign (35.00 beside a Discount Amount of 53198.25), so a number that
// is that share of the line counts as one too; otherwise it's the rupees taken off.
function parseLineDiscount(discount: string, discountAmount: string, gross: number) {
  if (discount.includes("%")) {
    const value = parseAmount(discount.replace("%", ""))
    return { value, isPercent: true, invalid: Number.isNaN(value) || value < 0 || value > 100 }
  }
  const number = parseAmount(discount)
  const amount = parseAmount(discountAmount)
  const isShareOfLine =
    number > 0 && number <= 100 && Math.abs((gross * number) / 100 - amount) < 0.01
  if (isShareOfLine) return { value: number, isPercent: true, invalid: false }
  const value = amount > 0 ? amount : number
  return { value, isPercent: false, invalid: Number.isNaN(value) || value < 0 }
}

type Group = { row: number; number: string; records: { row: number; record: string[] }[] }

// Reads a CSV file into quotations to import. A quotation with a bad row isn't imported at
// all (rather than with lines missing), and is reported with the reason.
export function readQuotationCsv(content: string): CsvReadResult<QuotationImportRow> {
  const [header = [], ...records] = parseCsv(content)
  const find = columnFinder(header)
  const indexOf = (column: Column) => find([column, ...(COLUMN_ALIASES[column] ?? [])])

  const missingColumns = REQUIRED_COLUMNS.filter((column) => indexOf(column) === undefined)
  if (missingColumns.length) {
    return { rows: [], problems: [], missingColumns, totalRows: records.length }
  }
  const positions = Object.fromEntries(
    QUOTATION_CSV_COLUMNS.map((column) => [column, indexOf(column)])
  ) as Record<Column, number | undefined>

  const getter = (record: string[]) => (column: Column) => {
    const position = positions[column]
    return position === undefined ? "" : (record[position] ?? "").trim()
  }

  const rows: QuotationImportRow[] = []
  const problems: ImportProblem[] = []

  // One quotation per Estimate Number, in file order.
  const groups = new Map<string, Group>()
  records.forEach((record, index) => {
    const row = index + 2
    const number = getter(record)("Estimate Number")
    if (!number) {
      problems.push({ row, name: "", message: "Estimate Number is blank" })
      return
    }
    const key = normalize(number)
    const group = groups.get(key) ?? { row, number, records: [] }
    group.records.push({ row, record })
    groups.set(key, group)
  })

  for (const group of groups.values()) {
    const get = getter(group.records[0].record)
    const report = (message: string, row = group.row) =>
      problems.push({ row, name: group.number, message })

    const quoteDate = parseDate(get("Estimate Date"))
    if (!quoteDate) {
      report(`Estimate Date "${get("Estimate Date")}" isn't a date`)
      continue
    }
    const expiryDate = get("Expiry Date") ? parseDate(get("Expiry Date")) : null
    if (get("Expiry Date") && !expiryDate) {
      report(`Expiry Date "${get("Expiry Date")}" isn't a date`)
      continue
    }
    if (expiryDate && expiryDate < quoteDate) {
      report("Expiry Date is before the Estimate Date")
      continue
    }

    const statusText = normalize(get("Estimate Status")).replace(/\s+/g, "_")
    const status = statusText ? STATUSES[statusText] : "Draft"
    if (!status) {
      report(`Estimate Status "${get("Estimate Status")}" isn't known`)
      continue
    }

    const rawPlace = get("Place of Supply")
    const placeOfSupply = toStateCode(rawPlace)
    if (rawPlace && !placeOfSupply) {
      report(`Place of Supply "${rawPlace}" isn't a state`)
      continue
    }

    const adjustment = parseAmount(get("Adjustment"))
    const entityPercent = parseAmount(get("Entity Discount Percent").replace("%", ""))
    const entityAmount = parseAmount(get("Entity Discount Amount"))
    if ([adjustment, entityPercent, entityAmount].some(Number.isNaN)) {
      report("Adjustment or the quote's discount isn't an amount")
      continue
    }
    const hasEntityDiscount = entityPercent > 0 || entityAmount > 0

    const lines: QuotationImportLine[] = []
    let lineProblem = false
    for (const { row, record } of group.records) {
      const line = getter(record)
      const quantity = parseAmount(line("Quantity") || "1")
      // Zoho allows a line of quantity 0: it adds nothing to the total, and can't be stored.
      if (quantity === 0) continue

      // A line can have only a description; it then serves as the name.
      const itemName = text(line("Item Name"))
      const description = text(line("Item Desc"))
      const name = (itemName ?? description)?.slice(0, 200) ?? null
      const rate = parseAmount(line("Item Price"))
      const discount = parseLineDiscount(line("Discount"), line("Discount Amount"), quantity * rate)

      const message = !name
        ? "Item Name is blank"
        : Number.isNaN(quantity) || quantity < 0
          ? `Quantity "${line("Quantity")}" isn't above 0`
          : Number.isNaN(rate) || rate < 0
            ? `Item Price "${line("Item Price")}" isn't an amount`
            : discount.invalid
              ? `Discount "${line("Discount")}" isn't valid`
              : null
      if (message || !name) {
        report(message ?? "Item Name is blank", row)
        lineProblem = true
        break
      }

      lines.push({
        row,
        name,
        itemExternalId: text(line("Product ID")),
        description: itemName ? description : null,
        hsnCode: text(line("HSN/SAC")),
        unit: text(line("Usage unit")),
        quantity,
        rate,
        discountValue: discount.value,
        discountIsPercent: discount.isPercent,
        taxName: text(line("Item Tax")),
      })
    }
    if (lineProblem) continue
    if (lines.length === 0) {
      report("Every line has a quantity of 0")
      continue
    }

    const parsed = quotationImportSchema.safeParse({
      row: group.row,
      quoteNumber: group.number,
      customerName: text(get("Customer Name")) ?? "",
      customerExternalId: text(get("Customer ID")),
      quoteDate,
      expiryDate,
      referenceNumber: text(get("Reference#")),
      subject: text(get("Subject")),
      placeOfSupply,
      status,
      discountLevel: hasEntityDiscount ? "Transaction" : "Line Item",
      discountValue: entityPercent > 0 ? entityPercent : entityAmount,
      discountIsPercent: entityPercent > 0 || !hasEntityDiscount,
      isDiscountBeforeTax: !["false", "no", "0"].includes(normalize(get("Is Discount Before Tax"))),
      adjustment,
      adjustmentDescription: text(get("Adjustment Description")),
      notes: text(get("Notes")),
      terms: text(get("Terms & Conditions")),
      lines,
    })
    if (parsed.success) {
      rows.push(parsed.data)
    } else {
      const issue = parsed.error.issues[0]
      report(`${issue.path.join(" ") || "Row"}: ${issue.message}`)
    }
  }

  problems.sort((a, b) => a.row - b.row)
  return { rows, problems, missingColumns: [], totalRows: records.length }
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

// One CSV row for each line of a quotation.
export function toQuotationCsvRows(
  quote: Tables<"quotations">,
  lines: Tables<"quotation_items">[]
): (string | number)[][] {
  const isTransaction = quote.discount_level === "Transaction"
  return lines.map((line) => {
    const values: Record<Column, string | number> = {
      "Estimate Date": quote.quote_date,
      "Estimate Number": quote.quote_number,
      "Estimate Status": quote.status,
      "Customer ID": quote.customer_id,
      "Customer Name": quote.customer_name,
      "Place of Supply": quote.place_of_supply ?? "",
      "Expiry Date": quote.expiry_date ?? "",
      "Reference#": quote.reference_number ?? "",
      Subject: quote.subject ?? "",
      "Discount Type": isTransaction ? "entity_level" : "item_level",
      "Is Discount Before Tax": String(quote.is_discount_before_tax),
      "Entity Discount Percent":
        isTransaction && quote.discount_is_percent ? quote.discount_value : "",
      "Entity Discount Amount":
        isTransaction && !quote.discount_is_percent ? quote.discount_value : "",
      "Item Name": line.name,
      "Product ID": line.item_id ?? "",
      "Item Desc": line.description ?? "",
      "HSN/SAC": line.hsn_code ?? "",
      "Usage unit": line.unit ?? "",
      Quantity: line.quantity,
      "Item Price": line.rate,
      Discount: line.discount_is_percent ? `${line.discount_value}%` : line.discount_value,
      "Discount Amount": round2(line.quantity * line.rate - line.amount),
      "Item Tax": line.tax_name ?? "",
      "Item Tax %": line.tax_rate ?? "",
      "Item Total": line.amount,
      SubTotal: quote.sub_total,
      Total: quote.total,
      Adjustment: quote.adjustment,
      "Adjustment Description": quote.adjustment_description ?? "",
      Notes: quote.notes ?? "",
      "Terms & Conditions": quote.terms ?? "",
    }
    return QUOTATION_CSV_COLUMNS.map((column) => values[column])
  })
}
