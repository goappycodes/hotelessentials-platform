"use client"

import { useRef } from "react"

import { ListActionsMenu } from "@/components/shared/list-actions-menu"
import { ROUTES } from "@/constants/routes"
import { ItemImportDialog, useItemImport } from "@/features/items/components/item-import"
import { ITEMS_LIST } from "@/features/items/list-config"

// The Items "⋯" menu. Import opens the file picker straight away and imports the chosen
// CSV on this page; Export downloads a CSV.
export function ItemsActionsMenu({
  entityLabel,
  canImport,
}: {
  entityLabel: string
  canImport: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { state, run, reset } = useItemImport()

  return (
    <>
      <ListActionsMenu
        entityLabel={entityLabel}
        config={ITEMS_LIST}
        onImport={canImport ? () => inputRef.current?.click() : undefined}
        exportHref={ROUTES.itemsExport}
      />
      {canImport && (
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Choose a CSV file of items to import"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Cleared so picking the same file again still triggers an import.
            event.target.value = ""
            if (file) void run(file)
          }}
        />
      )}
      <ItemImportDialog state={state} onClose={reset} />
    </>
  )
}
