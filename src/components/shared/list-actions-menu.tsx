"use client"

import {
  ArrowDownNarrowWide,
  ArrowDownUp,
  ArrowUpNarrowWide,
  Download,
  Ellipsis,
  Upload,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ListConfig } from "@/constants/list"
import { useListQuery } from "@/hooks/use-list-query"

type ExportScope = "all" | "current-view"
type ExportFormat = "xlsx" | "csv"

export type ListActionsMenuProps = {
  entityLabel: string
  config: ListConfig
  // Opens the module's import. Without it, Import is greyed out.
  onImport?: () => void
  // A Route Handler that returns the file (given ?scope=, ?format= and, for the current
  // view, the list's sort, filters and search). Without it, Export is greyed out.
  exportHref?: string
}

export function ListActionsMenu({
  entityLabel,
  config,
  onImport,
  exportHref,
}: ListActionsMenuProps) {
  const { query, setSort } = useListQuery(config)
  const [isExporting, setIsExporting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowDownUp />
              Sort by
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {config.sortOptions.map((option) => {
                const isCurrent = option.value === query.sort
                const OrderIcon =
                  query.order === "asc" ? ArrowUpNarrowWide : ArrowDownNarrowWide

                return (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => setSort(option.value)}
                    className={isCurrent ? "font-medium text-primary" : undefined}
                  >
                    {option.label}
                    {isCurrent && (
                      <OrderIcon
                        className="ml-auto text-primary"
                        aria-label={query.order === "asc" ? "Ascending" : "Descending"}
                      />
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem disabled={!onImport} onSelect={onImport}>
            <Download />
            Import {entityLabel}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!exportHref} onSelect={() => setIsExporting(true)}>
            <Upload />
            Export {entityLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {exportHref && (
        <ExportDialog
          open={isExporting}
          onOpenChange={setIsExporting}
          entityLabel={entityLabel}
          exportHref={exportHref}
        />
      )}
    </>
  )
}

// One choice in the dialog: a radio with its label and a line about it.
function ExportOption({
  id,
  value,
  label,
  description,
}: {
  id: string
  value: string
  label: string
  description: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <Label htmlFor={id} className="flex-col items-start gap-0.5 font-normal">
        <span className="text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </Label>
    </div>
  )
}

// Export: what to include and which file type, then one button.
function ExportDialog({
  open,
  onOpenChange,
  entityLabel,
  exportHref,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel: string
  exportHref: string
}) {
  const searchParams = useSearchParams()
  const [scope, setScope] = useState<ExportScope>("all")
  const [format, setFormat] = useState<ExportFormat>("xlsx")

  // A download link (the response is an attachment), so the page stays as it is.
  function download() {
    const params = new URLSearchParams(scope === "current-view" ? searchParams : undefined)
    params.set("scope", scope)
    params.set("format", format)
    const link = document.createElement("a")
    link.href = `${exportHref}?${params}`
    link.download = ""
    link.click()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export {entityLabel}</DialogTitle>
          <DialogDescription>Choose what to export and the file type.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-medium">What to export</legend>
            <RadioGroup
              value={scope}
              onValueChange={(value) => setScope(value as ExportScope)}
              className="gap-2.5"
            >
              <ExportOption
                id="export-all"
                value="all"
                label={`All ${entityLabel}`}
                description="Everything in the list."
              />
              <ExportOption
                id="export-view"
                value="current-view"
                label="Current View"
                description="All pages, with the search, filters and sort you have now."
              />
            </RadioGroup>
          </fieldset>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-medium">File type</legend>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
              className="gap-2.5"
            >
              <ExportOption
                id="export-xlsx"
                value="xlsx"
                label="Excel (.xlsx)"
                description="For Excel and Google Sheets."
              />
              <ExportOption
                id="export-csv"
                value="csv"
                label="CSV"
                description="Plain text, opens almost anywhere."
              />
            </RadioGroup>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={download}>
            <Upload />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
