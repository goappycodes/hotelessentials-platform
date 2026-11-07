// Despatches as a spreadsheet: one row per line item, with the despatch's details repeated
// on each row. Our exports can be imported again. Pure functions: used by the import in the
// browser and the export Route Handler.

import { parseAmount, parseDate, text } from "@/features/quotations/quotation-csv"
import { parseCsv } from "@/lib/csv"
import { columnFinder, type CsvReadResult, type ImportProblem } from "@/lib/csv-import"
import {
  despatchImportSchema,
  type DespatchImportLine,
  type DespatchImportRow,
} from "@/lib/validations/despatch-import"
import type { Tables } from "@/types/database"

// Columns written by the export, in order. The import reads these names and the aliases
// below, in any case; other columns are ignored.
export const DESPATCH_CSV_COLUMNS = [
  "Despatch Date",
  "Despatch Number",
  "Status",
  "Sales Order Number",
  "Customer Name",
  "Transporter",
  "Tracking Number",
  "Vehicle Number",
  "Notes",
  "Item Name",
  "SKU",
  "Unit",
  "Box Number",
  "Quantity",
] as const

type Column = (typeof DESPATCH_CSV_COLUMNS)[number]

const COLUMN_ALIASES: Partial<Record<Column, readonly string[]>> = {
  "Despatch Date": ["Dispatch Date", "Package Date", "Shipment Date", "Date"],
  "Despatch Number": ["Dispatch Number", "Package Number", "Package#", "Shipment Number"],
  Status: ["Despatch Status", "Dispatch Status", "Package Status", "Shipment Status"],
  "Sales Order Number": ["Sales Order#", "SO Number", "Order Number"],
  Transporter: ["Carrier", "Delivery Method"],
  "Tracking Number": ["Tracking#", "LR Number", "LR / Tracking Number"],
  "Vehicle Number": ["Vehicle No"],
  Unit: ["Usage unit"],
  "Box Number": ["Box No", "Box#", "Box"],
  Quantity: ["Quantity Packed", "Quantity Shipped"],
}

const REQUIRED_COLUMNS = [
  "Despatch Number",
  "Despatch Date",
  "Sales Order Number",
  "Item Name",
  "Box Number",
  "Quantity",
] as const

const STATUSES: Record<string, Tables<"despatches">["status"]> = {
  packed: "Packed",
  not_shipped: "Packed",
  despatched: "Despatched",
  dispatched: "Despatched",
  shipped: "Despatched",
  delivered: "Delivered",
}

const normalize = (value: string) => value.trim().toLowerCase()

type Group = { row: number; number: string; records: { row: number; record: string[] }[] }

// Reads a file into despatches to import. A despatch with a bad row isn't imported at all
// (rather than with lines missing), and is reported with the reason.
export function readDespatchCsv(content: string): CsvReadResult<DespatchImportRow> {
  const [header = [], ...records] = parseCsv(content)
  const find = columnFinder(header)
  const indexOf = (column: Column) => find([column, ...(COLUMN_ALIASES[column] ?? [])])

  const missingColumns = REQUIRED_COLUMNS.filter((column) => indexOf(column) === undefined)
  if (missingColumns.length) {
    return { rows: [], problems: [], missingColumns, totalRows: records.length }
  }
  const positions = Object.fromEntries(
    DESPATCH_CSV_COLUMNS.map((column) => [column, indexOf(column)])
  ) as Record<Column, number | undefined>

  const getter = (record: string[]) => (column: Column) => {
    const position = positions[column]
    return position === undefined ? "" : (record[position] ?? "").trim()
  }

  const rows: DespatchImportRow[] = []
  const problems: ImportProblem[] = []

  // One despatch per number, in file order.
  const groups = new Map<string, Group>()
  records.forEach((record, index) => {
    const row = index + 2
    const number = text(getter(record)("Despatch Number"))
    if (!number) {
      problems.push({ row, name: "", message: "Despatch Number is blank" })
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

    const despatchDate = parseDate(get("Despatch Date"))
    if (!despatchDate) {
      report(`Despatch Date "${get("Despatch Date")}" isn't a date`)
      continue
    }

    const statusText = normalize(get("Status")).replace(/\s+/g, "_")
    const status = statusText ? STATUSES[statusText] : "Packed"
    if (!status) {
      report(`Status "${get("Status")}" isn't known`)
      continue
    }

    const lines: DespatchImportLine[] = []
    const inBoxes = new Set<string>()
    let lineProblem = false
    for (const { row, record } of group.records) {
      const line = getter(record)
      const name = text(line("Item Name"))
      const sku = text(line("SKU"))
      const boxNumber = text(line("Box Number"))
      const quantity = parseAmount(line("Quantity"))
      const inBox = `${normalize(sku ?? name ?? "")}:${normalize(boxNumber ?? "")}`
      const message = !name
        ? "Item Name is blank"
        : boxNumber && inBoxes.has(inBox)
          ? `${name} is in box ${boxNumber} twice`
          : Number.isNaN(quantity) || quantity <= 0
            ? `Quantity "${line("Quantity")}" isn't above 0`
            : null
      if (message || !name) {
        report(message ?? "Item Name is blank", row)
        lineProblem = true
        break
      }
      inBoxes.add(inBox)
      lines.push({ row, name: name.slice(0, 200), sku, boxNumber, quantity })
    }
    if (lineProblem) continue

    const parsed = despatchImportSchema.safeParse({
      row: group.row,
      despatchNumber: group.number,
      soNumber: text(get("Sales Order Number")) ?? "",
      despatchDate,
      status,
      transporter: text(get("Transporter")),
      trackingNumber: text(get("Tracking Number")),
      vehicleNumber: text(get("Vehicle Number")),
      notes: text(get("Notes")),
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

// One row for each line of a despatch.
export function toDespatchCsvRows(
  despatch: Tables<"despatches">,
  lines: (Tables<"despatch_items"> & { item: { sku: string | null } | null })[]
): (string | number)[][] {
  return lines.map((line) => {
    const values: Record<Column, string | number> = {
      "Despatch Date": despatch.despatch_date,
      "Despatch Number": despatch.despatch_number,
      Status: despatch.status,
      "Sales Order Number": despatch.so_number,
      "Customer Name": despatch.customer_name,
      Transporter: despatch.transporter ?? "",
      "Tracking Number": despatch.tracking_number ?? "",
      "Vehicle Number": despatch.vehicle_number ?? "",
      Notes: despatch.notes ?? "",
      "Item Name": line.name,
      SKU: line.item?.sku ?? "",
      Unit: line.unit ?? "",
      "Box Number": line.box_number ?? "",
      Quantity: line.quantity,
    }
    return DESPATCH_CSV_COLUMNS.map((column) => values[column])
  })
}
