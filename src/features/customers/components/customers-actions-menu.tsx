"use client"

import { importCustomers } from "@/actions/customer-import"
import { CsvListActionsMenu, type CsvImporter } from "@/components/shared/csv-import"
import { CUSTOMER_IMPORT_BATCH_SIZE } from "@/constants/customers"
import { ROUTES } from "@/constants/routes"
import { readCustomerCsv } from "@/features/customers/customer-csv"
import { CUSTOMERS_LIST } from "@/features/customers/list-config"
import type { CustomerImportRow } from "@/lib/validations/customer-import"

// A Zoho Books contacts export imports as it is. Rows matching an existing customer (by
// Contact ID, or by display name for customers added in the app) are skipped.
const CUSTOMER_IMPORTER: CsvImporter<CustomerImportRow> = {
  entityPlural: "customers",
  nameColumn: "Display Name",
  read: readCustomerCsv,
  importBatch: importCustomers,
  batchSize: CUSTOMER_IMPORT_BATCH_SIZE,
  note: "Contact persons aren't part of this file; add them on each customer.",
}

// The Customers "⋯" menu: Import opens the file picker straight away; Export downloads a CSV.
export function CustomersActionsMenu({
  entityLabel,
  canImport,
}: {
  entityLabel: string
  canImport: boolean
}) {
  return (
    <CsvListActionsMenu
      entityLabel={entityLabel}
      config={CUSTOMERS_LIST}
      canImport={canImport}
      exportHref={ROUTES.customersExport}
      importer={CUSTOMER_IMPORTER}
    />
  )
}
