"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { LIST_SEARCH_PARAMS, type ListConfig } from "@/constants/list"
import { parseListQuery } from "@/lib/list-query"

type ParamChanges = Record<string, string | null>

// Sets or removes (null) query params on the current page, keeping the others.
export function useUpdateSearchParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function update(changes: ParamChanges, history: "push" | "replace" = "replace") {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key)
      else params.set(key, value)
    }
    const search = params.toString()
    const href = search ? `${pathname}?${search}` : pathname
    startTransition(() => router[history](href, { scroll: false }))
  }

  return { searchParams, update, isPending }
}

// Reads and updates a list's sort, filters and page in the URL, so the server page can
// fetch the same view with `parseListQuery` and the URL can be shared or bookmarked.
export function useListQuery(config: ListConfig) {
  const { searchParams, update, isPending } = useUpdateSearchParams()
  const query = parseListQuery(searchParams, config)

  // Changing the sort, a filter or the page size starts again from the first page.
  return {
    query,
    isPending,
    setSort(sort: string) {
      const order =
        sort === query.sort && query.order === "asc" ? "desc" : "asc"
      update({
        [LIST_SEARCH_PARAMS.sort]: sort,
        [LIST_SEARCH_PARAMS.order]: order,
        [LIST_SEARCH_PARAMS.page]: null,
      })
    },
    setFilter(key: string, value: string | null) {
      update({ [key]: value, [LIST_SEARCH_PARAMS.page]: null })
    },
    setPage(page: number) {
      update({ [LIST_SEARCH_PARAMS.page]: page > 1 ? String(page) : null }, "push")
    },
    setPerPage(perPage: number) {
      update({
        [LIST_SEARCH_PARAMS.perPage]: String(perPage),
        [LIST_SEARCH_PARAMS.page]: null,
      })
    },
  }
}
