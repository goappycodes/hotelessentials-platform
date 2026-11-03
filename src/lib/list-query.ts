import {
  DEFAULT_PAGE_SIZE,
  LIST_SEARCH_PARAMS,
  PAGE_SIZE_OPTIONS,
  type ListConfig,
  type SortOrder,
} from "@/constants/list"

// A page's awaited `searchParams` prop on the server, or `useSearchParams()` on the client.
export type ListSearchParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

export type ListQuery = {
  sort: string
  order: SortOrder
  page: number
  perPage: number
  filters: Record<string, string>
  search: { term: string; columns: readonly string[] } | null
}

const MAX_SEARCH_LENGTH = 100

function readParam(params: ListSearchParams, key: string) {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined
  const value = params[key]
  return Array.isArray(value) ? value[0] : value
}

// Characters with meaning in PostgREST filters or LIKE patterns are dropped, so the term
// can be embedded in an `or=(col.ilike.*term*)` filter safely.
function cleanSearchTerm(value: string | undefined) {
  return (value ?? "")
    .replace(/[%_*,()"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
}

// Invalid or unknown values fall back to the list's defaults, so the URL can never sort
// or filter on a column the list does not allow.
export function parseListQuery(
  params: ListSearchParams,
  config: ListConfig
): ListQuery {
  const sort = readParam(params, LIST_SEARCH_PARAMS.sort)
  const order = readParam(params, LIST_SEARCH_PARAMS.order)
  const page = Number(readParam(params, LIST_SEARCH_PARAMS.page))
  const perPage = Number(readParam(params, LIST_SEARCH_PARAMS.perPage))
  const term = cleanSearchTerm(readParam(params, LIST_SEARCH_PARAMS.search))

  const filters: Record<string, string> = {}
  for (const [key, allowed] of Object.entries(config.filters ?? {})) {
    const value = readParam(params, key)
    if (value !== undefined && allowed.includes(value)) filters[key] = value
  }

  return {
    sort:
      config.sortOptions.find((option) => option.value === sort)?.value ??
      config.defaultSort,
    order: order === "asc" || order === "desc" ? order : config.defaultOrder,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    perPage: PAGE_SIZE_OPTIONS.includes(perPage) ? perPage : DEFAULT_PAGE_SIZE,
    filters,
    search:
      config.search && term ? { term, columns: config.search.columns } : null,
  }
}

// The filters and search as URL-style params, e.g. for a count Server Action that must
// match the list (it re-parses them with `parseListQuery`).
export function toFilterParams(query: ListQuery): Record<string, string> {
  return query.search
    ? { ...query.filters, [LIST_SEARCH_PARAMS.search]: query.search.term }
    : query.filters
}

type FilterBuilder<Q> = {
  eq(column: string, value: string): Q
  or(filters: string): Q
}

type ListQueryBuilder<Q> = FilterBuilder<Q> & {
  order(column: string, options: { ascending: boolean }): Q
  range(from: number, to: number): Q
}

// Filters and search only (e.g. for a count query that must match the list).
export function applyListFilters<Q extends FilterBuilder<Q>>(
  builder: Q,
  query: Pick<ListQuery, "filters" | "search">
): Q {
  let result = builder
  for (const [column, value] of Object.entries(query.filters)) {
    result = result.eq(column, value)
  }
  if (query.search) {
    const { term, columns } = query.search
    result = result.or(columns.map((column) => `${column}.ilike.*${term}*`).join(","))
  }
  return result
}

// Applies sorting, filters, search and the current page to a Supabase select. It asks
// for one row more than the page size so `toListPage` can tell whether a next page
// exists without counting the whole table.
export function applyListQuery<Q extends ListQueryBuilder<Q>>(
  builder: Q,
  query: ListQuery
): Q {
  const from = (query.page - 1) * query.perPage
  return applyListFilters(builder, query)
    .order(query.sort, { ascending: query.order === "asc" })
    .range(from, from + query.perPage)
}

export type ListPage<T> = {
  rows: T[]
  hasNextPage: boolean
}

export function toListPage<T>(rows: T[], query: ListQuery): ListPage<T> {
  return {
    rows: rows.slice(0, query.perPage),
    hasNextPage: rows.length > query.perPage,
  }
}
