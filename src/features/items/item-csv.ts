// Items as CSV, in Zoho Books' item export format, so a Zoho export can be imported and
// our exports can be imported again (or into Zoho). Pure functions: used by the import
// page in the browser and the export Route Handler on the server.

import {
  INVENTORY_ACCOUNTS,
  PURCHASE_ACCOUNTS,
  SALES_ACCOUNTS,
  TAX_PREFERENCES,
} from "@/constants/items"
import { parseCsv } from "@/lib/csv"
import { itemImportRowSchema, type ItemImportRow } from "@/lib/validations/item-import"
import type { Enums, Tables } from "@/types/database"

// Columns written by the export, in order. The import reads these names (any case), the
// rest of a Zoho export is ignored.
export const ITEM_CSV_COLUMNS = [
  "Item ID",
  "Item Name",
  "SKU",
  "HSN/SAC",
  "CF.Full HSN Code",
  "Product Type",
  "Usage unit",
  "Taxable",
  "Taxability Type",
  "Intra State Tax Name",
  "Intra State Tax Rate",
  "Inter State Tax Name",
  "Inter State Tax Rate",
  "Sellable",
  "Rate",
  "Account",
  "Description",
  "Purchasable",
  "Purchase Rate",
  "Purchase Account",
  "Purchase Description",
  "Vendor",
  "Track Inventory",
  "Inventory Account",
  "Inventory Valuation Method",
  "Status",
] as const

// Other names accepted for a column, e.g. from a hand-made sheet.
const COLUMN_ALIASES: Record<string, readonly string[]> = {
  "Item Name": ["Name"],
  "HSN/SAC": ["HSN Code", "HSN"],
  "CF.Full HSN Code": ["Full HSN Code"],
  "Product Type": ["Type"],
  "Usage unit": ["Unit"],
  Rate: ["Selling Price"],
  Account: ["Sales Account"],
  Description: ["Sales Description"],
  "Purchase Rate": ["Cost Price"],
  Vendor: ["Preferred Vendor"],
}

// The only column a file must have.
export const REQUIRED_ITEM_COLUMNS = ["Item Name"] as const

export type ImportProblem = { row: number; name: string; message: string }

export type ReadItemCsvResult = {
  rows: ItemImportRow[]
  problems: ImportProblem[]
  missingColumns: string[]
  // Data rows in the file (not counting the header).
  totalRows: number
}

const FIELD_LABELS: Partial<Record<keyof ItemImportRow, string>> = {
  externalId: "Item ID",
  name: "Item Name",
  sku: "SKU",
  unit: "Usage unit",
  hsnCode: "HSN code",
  sellingPrice: "Rate",
  costPrice: "Purchase Rate",
  salesDescription: "Description",
  purchaseDescription: "Purchase Description",
  preferredVendor: "Vendor",
  intraTaxName: "Intra State Tax Name",
  interTaxName: "Inter State Tax Name",
}

const normalize = (name: string) => name.trim().toLowerCase()

// "INR 1,234.50", "₹99.982" or "600" → 600. Rounded to 4 decimals (how amounts are
// stored). Blank → 0. Not a number → NaN, reported as a problem.
function parseAmount(value: string) {
  const text = value.replace(/INR|₹|,|\s/gi, "")
  if (!text) return 0
  if (!/^\d+(\.\d+)?$/.test(text)) return Number.NaN
  return Math.round(Number(text) * 10_000) / 10_000
}

function parseBoolean(value: string, fallback: boolean) {
  const text = normalize(value)
  if (["true", "yes", "1", "y"].includes(text)) return true
  if (["false", "no", "0", "n"].includes(text)) return false
  return fallback
}

const text = (value: string) => value.trim() || null

// Reads a CSV file into items to import, with a list of rows that can't be imported.
export function readItemCsv(content: string): ReadItemCsvResult {
  const [header = [], ...records] = parseCsv(content)
  const positions = new Map(header.map((name, index) => [normalize(name), index]))

  function indexOf(column: string) {
    for (const name of [column, ...(COLUMN_ALIASES[column] ?? [])]) {
      const index = positions.get(normalize(name))
      if (index !== undefined) return index
    }
    return undefined
  }

  const missingColumns = REQUIRED_ITEM_COLUMNS.filter((column) => indexOf(column) === undefined)
  if (missingColumns.length) {
    return { rows: [], problems: [], missingColumns, totalRows: records.length }
  }

  const columnIndex = Object.fromEntries(
    ITEM_CSV_COLUMNS.map((column) => [column, indexOf(column)])
  ) as Record<(typeof ITEM_CSV_COLUMNS)[number], number | undefined>

  const rows: ItemImportRow[] = []
  const problems: ImportProblem[] = []
  const seenIds = new Map<string, number>()

  records.forEach((record, index) => {
    const row = index + 2
    const get = (column: (typeof ITEM_CSV_COLUMNS)[number]) => {
      const position = columnIndex[column]
      return position === undefined ? "" : (record[position] ?? "").trim()
    }

    const name = get("Item Name")
    const report = (message: string) => problems.push({ row, name, message })

    // Item type: Zoho "Item Type" is Sales / Purchases / Sales and Purchases / Inventory.
    const sellable = parseBoolean(get("Sellable"), true)
    const purchasable = parseBoolean(get("Purchasable"), true)

    // The 8-digit Full HSN code when it is valid, otherwise HSN/SAC.
    const fullHsn = get("CF.Full HSN Code")
    const shortHsn = get("HSN/SAC")
    const hsnCode = [fullHsn, shortHsn].find((code) => /^\d{4,8}$/.test(code)) ?? null

    const isTaxable = parseBoolean(get("Taxable"), true)
    const taxability = TAX_PREFERENCES.find(
      (preference) => normalize(preference) === normalize(get("Taxability Type"))
    )
    const taxPreference = isTaxable ? "Taxable" : taxability && taxability !== "Taxable" ? taxability : "Non-Taxable"

    const sellingPrice = parseAmount(get("Rate"))
    const costPrice = parseAmount(get("Purchase Rate"))
    if (Number.isNaN(sellingPrice)) return report(`Rate "${get("Rate")}" isn't an amount`)
    if (Number.isNaN(costPrice)) return report(`Purchase Rate "${get("Purchase Rate")}" isn't an amount`)

    const valuation = normalize(get("Inventory Valuation Method"))
    const candidate = {
      row,
      externalId: text(get("Item ID")),
      type: normalize(get("Product Type")) === "service" ? "Service" : "Goods",
      name,
      sku: text(get("SKU")),
      unit: text(get("Usage unit")),
      hsnCode,
      taxPreference,
      intraTaxName: isTaxable ? text(get("Intra State Tax Name")) : null,
      interTaxName: isTaxable ? text(get("Inter State Tax Name")) : null,
      salesEnabled: sellable,
      sellingPrice,
      // Accounts this app doesn't have fall back to the defaults.
      salesAccount: SALES_ACCOUNTS.find((account) => account === get("Account")) ?? "Sales",
      salesDescription: text(get("Description")),
      purchaseEnabled: purchasable,
      costPrice,
      purchaseAccount:
        PURCHASE_ACCOUNTS.find((account) => account === get("Purchase Account")) ??
        "Cost of Goods Sold",
      purchaseDescription: text(get("Purchase Description")),
      preferredVendor: text(get("Vendor")),
      trackInventory: parseBoolean(get("Track Inventory"), false),
      inventoryAccount:
        INVENTORY_ACCOUNTS.find((account) => account === get("Inventory Account")) ??
        "Inventory Asset",
      inventoryValuationMethod:
        valuation.startsWith("wac") || valuation.includes("average")
          ? "WAC (Weighted Average Costing)"
          : "FIFO (First In, First Out)",
      isActive: normalize(get("Status")) !== "inactive",
    }

    const parsed = itemImportRowSchema.safeParse(candidate)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const field = issue?.path[0] as keyof ItemImportRow | undefined
      return report(`${(field && FIELD_LABELS[field]) ?? "A value"} ${issue?.message ?? "is invalid"}`)
    }
    const item = parsed.data

    if (item.taxPreference === "Taxable" && (!item.intraTaxName || !item.interTaxName)) {
      return report("Taxable items need an Intra State Tax Name and an Inter State Tax Name")
    }

    // An Item ID repeated within the file: the first row wins. (SKUs may repeat: different
    // items can share one, as in Zoho.)
    if (item.externalId) {
      const first = seenIds.get(item.externalId)
      if (first) return report(`Item ID "${item.externalId}" is also used on row ${first}`)
      seenIds.set(item.externalId, row)
    }

    rows.push(item)
  })

  return { rows, problems, missingColumns: [], totalRows: records.length }
}

type ExportTax = { name: string; rate: number | null }

// One item as a row of ITEM_CSV_COLUMNS.
export function toItemCsvRow(
  item: Tables<"items"> & { hsn_code: string | null },
  taxes: { intra: ExportTax | null; inter: ExportTax | null }
) {
  const isTaxable = item.tax_preference === "Taxable"
  // An 8-digit code is the full HSN code; HSN/SAC gets its first 6 digits, like Zoho.
  const hsn = item.hsn_code
  const valuation: Record<Enums<"inventory_valuation_method">, string> = {
    "FIFO (First In, First Out)": "fifo",
    "WAC (Weighted Average Costing)": "wac",
  }

  const values: Record<(typeof ITEM_CSV_COLUMNS)[number], string | number> = {
    // Imported items keep their source ID, so re-importing into Zoho or here matches them.
    "Item ID": item.external_id ?? item.id,
    "Item Name": item.name,
    SKU: item.sku ?? "",
    "HSN/SAC": hsn ? hsn.slice(0, 6) : "",
    "CF.Full HSN Code": hsn && hsn.length === 8 ? hsn : "",
    "Product Type": item.type === "Service" ? "service" : "goods",
    "Usage unit": item.unit ?? "",
    Taxable: isTaxable ? "true" : "false",
    "Taxability Type": isTaxable ? "" : item.tax_preference,
    "Intra State Tax Name": isTaxable ? (taxes.intra?.name ?? "") : "",
    "Intra State Tax Rate": isTaxable ? (taxes.intra?.rate ?? "") : "",
    "Inter State Tax Name": isTaxable ? (taxes.inter?.name ?? "") : "",
    "Inter State Tax Rate": isTaxable ? (taxes.inter?.rate ?? "") : "",
    Sellable: item.sales_enabled ? "true" : "false",
    Rate: item.selling_price,
    Account: item.sales_account,
    Description: item.sales_description ?? "",
    Purchasable: item.purchase_enabled ? "true" : "false",
    "Purchase Rate": item.cost_price,
    "Purchase Account": item.purchase_account,
    "Purchase Description": item.purchase_description ?? "",
    Vendor: item.preferred_vendor ?? "",
    "Track Inventory": item.track_inventory ? "true" : "false",
    "Inventory Account": item.track_inventory ? item.inventory_account : "",
    "Inventory Valuation Method": item.track_inventory
      ? valuation[item.inventory_valuation_method]
      : "",
    Status: item.is_active ? "Active" : "Inactive",
  }
  return ITEM_CSV_COLUMNS.map((column) => values[column])
}

// A sample file: the header and one example item.
export const SAMPLE_ITEM_CSV_ROWS = [
  [...ITEM_CSV_COLUMNS],
  [
    "",
    "Borosil Kettle 1.5 ltr",
    "BOROSIL1.5LTR",
    "851671",
    "85167100",
    "goods",
    "pcs",
    "true",
    "",
    "GST18",
    "18",
    "IGST18",
    "18",
    "true",
    "952",
    "Sales",
    "",
    "true",
    "486.99",
    "Cost of Goods Sold",
    "",
    "",
    "false",
    "",
    "",
    "Active",
  ],
]
