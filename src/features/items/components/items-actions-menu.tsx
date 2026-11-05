"use client"

import { importItems } from "@/actions/item-import"
import { CsvListActionsMenu, type CsvImporter } from "@/components/shared/csv-import"
import { ITEM_IMPORT_BATCH_SIZE } from "@/constants/items"
import { ROUTES } from "@/constants/routes"
import { readItemCsv } from "@/features/items/item-csv"
import { ITEMS_LIST } from "@/features/items/list-config"
import type { ItemImportRow } from "@/lib/validations/item-import"

// A Zoho Books item export imports as it is. Rows matching an existing item (by Item ID,
// or by SKU for items added in the app) are skipped.
const ITEM_IMPORTER: CsvImporter<ItemImportRow> = {
  entityPlural: "items",
  nameColumn: "Item Name",
  read: readItemCsv,
  importBatch: (rows) => importItems(rows, "skip"),
  batchSize: ITEM_IMPORT_BATCH_SIZE,
  note: "Stock levels in the file aren't imported.",
}

// The Items "⋯" menu: Import and Export each open a dialog (CSV or Excel).
export function ItemsActionsMenu({
  entityLabel,
  canImport,
}: {
  entityLabel: string
  canImport: boolean
}) {
  return (
    <CsvListActionsMenu
      entityLabel={entityLabel}
      config={ITEMS_LIST}
      canImport={canImport}
      exportHref={ROUTES.itemsExport}
      importer={ITEM_IMPORTER}
    />
  )
}
