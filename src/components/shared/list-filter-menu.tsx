"use client"

import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ListConfig } from "@/constants/list"
import { useListQuery } from "@/hooks/use-list-query"

const ALL = "__all__"

type ListFilterMenuProps = {
  config: ListConfig
  // A key from `config.filters`; it is also the URL param and the column name.
  filterKey: string
  label: string
  options: { value: string; label: string }[]
}

export function ListFilterMenu({
  config,
  filterKey,
  label,
  options,
}: ListFilterMenuProps) {
  const { query, setFilter } = useListQuery(config)
  const current = query.filters[filterKey]
  const currentLabel = options.find((option) => option.value === current)?.label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <span className="text-muted-foreground">{label}:</span>
          {currentLabel ?? "All"}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup
          value={current ?? ALL}
          onValueChange={(value) => setFilter(filterKey, value === ALL ? null : value)}
        >
          <DropdownMenuRadioItem value={ALL}>All</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
