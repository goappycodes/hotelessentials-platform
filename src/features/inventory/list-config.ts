import { STOCK_STATUSES } from "@/constants/inventory"
import type { ListConfig } from "@/constants/list"

export const INVENTORY_LIST: ListConfig = {
  sortOptions: [
    { value: "name", label: "Item Name" },
    { value: "sku", label: "SKU" },
    { value: "current_stock", label: "Current Stock" },
    { value: "reserved_stock", label: "Reserved Stock" },
    { value: "available_stock", label: "Available Stock" },
    { value: "ordered_quantity", label: "Ordered Quantity" },
    { value: "reorder_level", label: "Reorder Level" },
  ],
  defaultSort: "name",
  defaultOrder: "asc",
  filters: {
    stock_status: STOCK_STATUSES,
  },
  search: { columns: ["name", "sku"] },
}

export const STOCK_STATUS_FILTER_OPTIONS = STOCK_STATUSES.map((status) => ({
  value: status,
  label: status,
}))
