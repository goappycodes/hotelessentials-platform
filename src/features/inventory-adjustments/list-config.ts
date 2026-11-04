import type { ListConfig } from "@/constants/list"
import { ADJUSTMENT_STATUSES } from "@/constants/inventory"

export const INVENTORY_ADJUSTMENTS_LIST: ListConfig = {
  sortOptions: [
    { value: "adjustment_date", label: "Date" },
    { value: "reason", label: "Reason" },
    { value: "reference_number", label: "Reference Number" },
    { value: "created_at", label: "Created Time" },
    { value: "updated_at", label: "Last Modified Time" },
  ],
  defaultSort: "adjustment_date",
  defaultOrder: "desc",
  filters: {
    status: ADJUSTMENT_STATUSES,
  },
  search: { columns: ["reason", "reference_number", "description"] },
}

export const ADJUSTMENT_STATUS_FILTER_OPTIONS = ADJUSTMENT_STATUSES.map((status) => ({
  value: status,
  label: status,
}))
