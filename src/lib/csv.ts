// CSV reading and writing (RFC 4180): fields may be quoted, contain commas, quotes ("")
// and line breaks. Used by list imports and exports.

// Rows of fields. Blank lines are dropped; a leading byte-order mark is ignored.
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  function endRow() {
    row.push(field)
    if (row.some((value) => value !== "")) rows.push(row)
    row = []
    field = ""
  }

  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++
      endRow()
    } else {
      field += char
    }
  }
  if (field !== "" || row.length > 0) endRow()
  return rows
}

function toCsvField(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// A CSV file's text. Starts with a byte-order mark so Excel reads it as UTF-8 (₹, names).
export function toCsv(rows: readonly (readonly (string | number | boolean | null | undefined)[])[]) {
  return "﻿" + rows.map((row) => row.map(toCsvField).join(",")).join("\r\n") + "\r\n"
}
