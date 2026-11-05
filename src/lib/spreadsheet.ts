// Excel files in list imports. An .xlsx is turned into the same text a CSV gives, so every
// import reads both the same way. Google Sheets can download either format.

import { toCsv } from "@/lib/csv"

// For the file picker.
export const SPREADSHEET_ACCEPT =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export const isCsvFile = (fileName: string) => /\.csv$/i.test(fileName)
export const isExcelFile = (fileName: string) => /\.xlsx$/i.test(fileName)

// A number as written in the file ("1E-3" → "0.001"). Kept as text, because long IDs such
// as Zoho's 4036694000000041007 are too big to be exact as numbers.
function numberText(value: string) {
  return /e/i.test(value) ? String(Number(value)) : value
}

function cellText(cell: unknown) {
  if (cell === null || cell === undefined) return ""
  // A date cell: its day, as the CSV would have it.
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return typeof cell === "string" ? cell : String(cell)
}

// A sheet's rows as CSV text.
export function sheetToCsv(rows: readonly (readonly unknown[])[]) {
  return toCsv(rows.map((row) => row.map(cellText)))
}

// The first sheet of an .xlsx file as CSV text. The library loads only when it's needed.
export async function readExcelAsCsv(file: File) {
  const { readSheet } = await import("read-excel-file/browser")
  const rows = await readSheet(file, { parseNumber: numberText })
  return sheetToCsv(rows)
}

export { numberText }
