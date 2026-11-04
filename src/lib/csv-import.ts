// Shared shapes for CSV imports (items, customers): what reading a file gives, and what
// the server returns for each batch of rows.

export type ImportProblem = { row: number; name: string; message: string }

export type CsvReadResult<Row> = {
  rows: Row[]
  // Rows that can't be imported, with the reason.
  problems: ImportProblem[]
  missingColumns: string[]
  // Data rows in the file (not counting the header).
  totalRows: number
}

export type CsvImportResult = {
  created: number
  updated: number
  // Rows matching an existing record, left alone.
  skipped: number
  failed: ImportProblem[]
}

// Finds a column by its name or one of its other names, ignoring case and spaces.
export function columnFinder(header: string[]) {
  const positions = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]))
  return (names: readonly string[]) => {
    for (const name of names) {
      const index = positions.get(name.trim().toLowerCase())
      if (index !== undefined) return index
    }
    return undefined
  }
}
