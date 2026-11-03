"use client"

import {
  ArrowDownNarrowWide,
  ArrowDownUp,
  ArrowUpNarrowWide,
  Download,
  Ellipsis,
  RefreshCw,
  RotateCcw,
  Settings,
  Upload,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onPreferences?: () => void
  onResetColumnWidth?: () => void
}

export function ListActionsMenu({
  entityLabel,
  config,
  onImport,
  onExport,
  onPreferences,
  onResetColumnWidth,
}: ListActionsMenuProps) {
  const router = useRouter()
  const { query, setSort } = useListQuery(config)
  const [isRefreshing, startRefresh] = useTransition()

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
              disabled={!onExport}
              onSelect={() => onExport?.("all")}
            >
              Export {entityLabel}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!onExport}
              onSelect={() => onExport?.("current-view")}
            >
              Export Current View
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!onPreferences} onSelect={onPreferences}>
          <Settings />
          Preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isRefreshing}
          onSelect={(event) => {
            event.preventDefault()
            startRefresh(() => router.refresh())
          }}
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
          Refresh List
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!onResetColumnWidth}
          onSelect={onResetColumnWidth}
        >
          <RotateCcw />
          Reset Column Width
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
