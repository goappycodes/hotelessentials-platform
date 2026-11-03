"use client"

import { ChevronLeft, ChevronRight, Settings } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { PAGE_SIZE_OPTIONS, type ListConfig } from "@/constants/list"
import { useListQuery } from "@/hooks/use-list-query"
import { toFilterParams } from "@/lib/list-query"

export type ListPaginationProps = {
  config: ListConfig
  // Rows on the current page and whether another page follows (see `toListPage`).
  itemCount: number
  hasNextPage: boolean
  // Pass the total when it is already known, or a Server Action that counts the rows
  // for the current filters and search (`?q=`); it only runs when the user clicks "View".
  totalCount?: number
  countAction?: (filters: Record<string, string>) => Promise<number>
}

export function ListPagination({
  config,
  itemCount,
  hasNextPage,
  totalCount,
  countAction,
}: ListPaginationProps) {
  const { query, isPending, setPage, setPerPage } = useListQuery(config)
  const firstRow = (query.page - 1) * query.perPage

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <TotalCount
        totalCount={totalCount}
        countAction={countAction}
        filters={toFilterParams(query)}
      />
      <ButtonGroup aria-label="Pagination">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-muted-foreground">
              <Settings />
              <span className="text-foreground">{query.perPage} per page</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuRadioGroup
              value={String(query.perPage)}
              onValueChange={(value) => setPerPage(Number(value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <DropdownMenuRadioItem key={size} value={String(size)}>
                  {size} per page
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={query.page <= 1 || isPending}
          onClick={() => setPage(query.page - 1)}
        >
          <ChevronLeft />
        </Button>
        <ButtonGroupText className="h-7 min-w-16 justify-center bg-background font-normal tabular-nums">
          {isPending ? (
            <Spinner />
          ) : itemCount > 0 ? (
            `${firstRow + 1} - ${firstRow + itemCount}`
          ) : (
            "0"
          )}
        </ButtonGroupText>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={!hasNextPage || isPending}
          onClick={() => setPage(query.page + 1)}
        >
          <ChevronRight />
        </Button>
      </ButtonGroup>
    </div>
  )
}

type TotalCountProps = Pick<ListPaginationProps, "totalCount" | "countAction"> & {
  filters: Record<string, string>
}

function TotalCount({ totalCount, countAction, filters }: TotalCountProps) {
  const filtersKey = JSON.stringify(filters)
  const [counted, setCounted] = useState<{ key: string; count: number } | null>(null)
  const [isCounting, startCounting] = useTransition()

  // A count fetched for other filters is stale, so "View" shows again.
  const count = totalCount ?? (counted?.key === filtersKey ? counted.count : undefined)

  if (count === undefined && !countAction) return <span />

  function handleView() {
    if (!countAction) return
    startCounting(async () => {
      try {
        setCounted({ key: filtersKey, count: await countAction(filters) })
      } catch {
        toast.error("Couldn't load the total count. Please try again.")
      }
    })
  }

  return (
    <p className="flex items-center gap-1 text-muted-foreground">
      Total Count:
      {count !== undefined ? (
        <span className="font-medium text-foreground tabular-nums">{count}</span>
      ) : (
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          disabled={isCounting}
          onClick={handleView}
        >
          {isCounting && <Spinner />}
          View
        </Button>
      )}
    </p>
  )
}

export function ListPaginationSkeleton() {
  return (
    <div
      aria-busy="true"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-7 w-56" />
    </div>
  )
}
