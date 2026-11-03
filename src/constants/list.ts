export type SortOrder = "asc" | "desc"

export type SortOption = {
  value: string
  label: string
}

export const LIST_SEARCH_PARAMS = {
  sort: "sort",
  order: "order",
  page: "page",
  perPage: "per_page",
  search: "q",
} as const

export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100, 200]

export const DEFAULT_PAGE_SIZE = 200

export const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "created_at", label: "Created Time" },
  { value: "updated_at", label: "Last Modified Time" },
]

// What a list page lets the URL control. Sort values and filter keys are column names;
// anything not listed here is ignored when the query string is parsed.
export type ListConfig = {
  sortOptions: readonly SortOption[]
  defaultSort: string
  defaultOrder: SortOrder
  filters?: Record<string, readonly string[]>
  // Columns the header search (`?q=`) matches, case-insensitively.
  search?: { columns: readonly string[] }
}

export const DEFAULT_LIST_CONFIG: ListConfig = {
  sortOptions: DEFAULT_SORT_OPTIONS,
  defaultSort: "created_at",
  defaultOrder: "desc",
  search: { columns: ["name"] },
}
