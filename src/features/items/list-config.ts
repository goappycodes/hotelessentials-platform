import type { ListConfig } from "@/constants/list"
import { ITEM_TYPES } from "@/constants/items"

export const ITEMS_LIST: ListConfig = {
  sortOptions: [
    { value: "name", label: "Name" },
    { value: "sku", label: "SKU" },
    { value: "hsn_code", label: "HSN Code" },
    { value: "selling_price", label: "Rate" },
    { value: "cost_price", label: "Purchase Rate" },
    { value: "created_at", label: "Created Time" },
    { value: "updated_at", label: "Last Modified Time" },
  ],
  defaultSort: "name",
  defaultOrder: "asc",
  filters: {
    type: ITEM_TYPES,
    is_active: ["true", "false"],
  },
  // Columns of the item_list view (items plus their HSN code).
  search: { columns: ["name", "sku", "hsn_code"] },
}

export const ITEM_TYPE_FILTER_OPTIONS = ITEM_TYPES.map((type) => ({ value: type, label: type }))

export const ITEM_STATUS_FILTER_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]
