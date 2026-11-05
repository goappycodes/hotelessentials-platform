"use client"

import { importQuotations } from "@/actions/quotation-import"
import { CsvListActionsMenu, type CsvImporter } from "@/components/shared/csv-import"
import { QUOTATION_IMPORT_BATCH_SIZE } from "@/constants/quotations"
import { ROUTES } from "@/constants/routes"
import { QUOTATIONS_LIST } from "@/features/quotations/list-config"
import { readQuotationCsv } from "@/features/quotations/quotation-csv"
import type { QuotationImportRow } from "@/lib/validations/quotation-import"

// A quotation has one row per line item in the file, grouped by Estimate Number. A number
// that already exists is skipped, so a file can be imported again safely.
const QUOTATION_IMPORTER: CsvImporter<QuotationImportRow> = {
  entityPlural: "quotations",
  nameColumn: "Estimate Number",
  read: readQuotationCsv,
  importBatch: importQuotations,
  batchSize: QUOTATION_IMPORT_BATCH_SIZE,
  note: "Salesperson, price lists and attachments aren't part of this file.",
}

// The Quotations "⋯" menu: Import and Export each open a dialog (CSV or Excel).
export function QuotationsActionsMenu({
  entityLabel,
  canImport,
}: {
  entityLabel: string
  canImport: boolean
}) {
  return (
    <CsvListActionsMenu
      entityLabel={entityLabel}
      config={QUOTATIONS_LIST}
      canImport={canImport}
      exportHref={ROUTES.quotationsExport}
      importer={QUOTATION_IMPORTER}
    />
  )
}
