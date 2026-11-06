"use client"

import { importDespatches } from "@/actions/despatch-import"
import { CsvListActionsMenu, type CsvImporter } from "@/components/shared/csv-import"
import { DESPATCH_IMPORT_BATCH_SIZE } from "@/constants/despatch"
import { ROUTES } from "@/constants/routes"
import { readDespatchCsv } from "@/features/despatch/despatch-csv"
import { DESPATCH_LIST } from "@/features/despatch/list-config"
import type { DespatchImportRow } from "@/lib/validations/despatch-import"

// A despatch has one row per line item in the file, grouped by Despatch Number. A number
// that already exists is skipped, so a file can be imported again safely.
const DESPATCH_IMPORTER: CsvImporter<DespatchImportRow> = {
  entityPlural: "despatches",
  nameColumn: "Despatch Number",
  read: readDespatchCsv,
  importBatch: importDespatches,
  batchSize: DESPATCH_IMPORT_BATCH_SIZE,
  note: "Sales orders must be Confirmed, and each item must be on its order.",
}

// The Despatch "⋯" menu: Import and Export each open a dialog (CSV or Excel).
export function DespatchActionsMenu({
  entityLabel,
  canImport,
}: {
  entityLabel: string
  canImport: boolean
}) {
  return (
    <CsvListActionsMenu
      entityLabel={entityLabel}
      config={DESPATCH_LIST}
      canImport={canImport}
      exportHref={ROUTES.despatchExport}
      importer={DESPATCH_IMPORTER}
    />
  )
}
