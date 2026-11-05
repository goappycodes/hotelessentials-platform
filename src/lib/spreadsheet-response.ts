import "server-only"

import { toCsv } from "@/lib/csv"

type Cell = string | number | boolean | null | undefined

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

// Rows as an .xlsx file: a bold header row, and blank cells left empty. Text stays text, so
// long IDs and codes aren't turned into numbers by Excel.
async function toXlsx(rows: readonly (readonly Cell[])[]) {
  const { default: writeXlsxFile } = await import("write-excel-file/node")
  const [header = [], ...records] = rows
  return writeXlsxFile([
    header.map((value) => ({ value: String(value ?? ""), fontWeight: "bold" as const })),
    ...records.map((row) => row.map((value) => (value === "" ? null : (value ?? null)))),
  ]).toBuffer()
}

// A list export download: CSV, or Excel with ?format=xlsx.
export async function spreadsheetResponse(
  rows: readonly (readonly Cell[])[],
  name: string,
  format: string | undefined
) {
  const extension = format === "xlsx" ? "xlsx" : "csv"
  const body = extension === "xlsx" ? new Uint8Array(await toXlsx(rows)) : toCsv(rows)
  const date = new Date().toISOString().slice(0, 10)
  return new Response(body, {
    headers: {
      "Content-Type": CONTENT_TYPES[extension],
      "Content-Disposition": `attachment; filename="${name}-${date}.${extension}"`,
      "Cache-Control": "no-store",
    },
  })
}
