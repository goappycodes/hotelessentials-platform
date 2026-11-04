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

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ListConfig } from "@/constants/list"
import { useListQuery } from "@/hooks/use-list-query"

export type ExportScope = "all" | "current-view"

export type ListActionsMenuProps = {
  entityLabel: string
  config: ListConfig
  onImport?: () => void
  onExport?: (scope: ExportScope) => void
  // Instead of onExport, so server pages can pass it: a Route Handler that returns the
  // CSV (given ?scope= and, for the current view, the list's sort, filters and search).
  exportHref?: string
}

export function ListActionsMenu({
  entityLabel,
  config,
  onImport,
  onExport,
  exportHref,
}: ListActionsMenuProps) {
  const searchParams = useSearchParams()
  const { query, setSort } = useListQuery(config)

  // A download link (the response is an attachment), so the page stays as it is.
  function download(scope: ExportScope) {
    const params = new URLSearchParams(scope === "current-view" ? searchParams : undefined)
    params.set("scope", scope)
    const link = document.createElement("a")
    link.href = `${exportHref}?${params}`
    link.download = ""
    link.click()
  }

  return (
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download />
            Import
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuItem disabled={!onImport} onSelect={onImport}>
              Import {entityLabel}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Upload />
            Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuItem
              disabled={!onExport && !exportHref}
              onSelect={() => (exportHref ? download("all") : onExport?.("all"))}
            >
              Export {entityLabel}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!onExport && !exportHref}
              onSelect={() =>
                exportHref ? download("current-view") : onExport?.("current-view")
              }
            >
              Export Current View
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
