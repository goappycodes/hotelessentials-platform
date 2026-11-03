import type { ListConfig } from "@/constants/list"
import { PRICE_LIST_TYPES, TRANSACTION_TYPES } from "@/constants/price-lists"

export const PRICE_LISTS_LIST: ListConfig = {
  sortOptions: [
    { value: "name", label: "Name" },
    { value: "created_at", label: "Created Time" },
    { value: "updated_at", label: "Last Modified Time" },
  ],
  defaultSort: "name",
  defaultOrder: "asc",
  filters: {
    transaction_type: TRANSACTION_TYPES,
    price_list_type: PRICE_LIST_TYPES,
    is_active: ["true", "false"],
  },
  search: { columns: ["name", "description"] },
}

const toOptions = (values: readonly string[]) => values.map((value) => ({ value, label: value }))

export const TRANSACTION_TYPE_FILTER_OPTIONS = toOptions(TRANSACTION_TYPES)
export const PRICE_LIST_TYPE_FILTER_OPTIONS = toOptions(PRICE_LIST_TYPES)
export const PRICE_LIST_STATUS_FILTER_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]
