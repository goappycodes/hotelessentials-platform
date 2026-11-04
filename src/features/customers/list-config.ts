import type { ListConfig } from "@/constants/list"
import { CUSTOMER_TYPES } from "@/constants/customers"

export const CUSTOMERS_LIST: ListConfig = {
  sortOptions: [
    { value: "display_name", label: "Name" },
    { value: "company_name", label: "Company Name" },
    { value: "created_at", label: "Created Time" },
    { value: "updated_at", label: "Last Modified Time" },
  ],
  defaultSort: "display_name",
  defaultOrder: "asc",
  filters: {
    customer_type: CUSTOMER_TYPES,
    is_active: ["true", "false"],
  },
  search: { columns: ["display_name", "company_name", "email", "work_phone", "mobile", "gstin"] },
}

export const CUSTOMER_TYPE_FILTER_OPTIONS = CUSTOMER_TYPES.map((type) => ({
  value: type,
  label: type,
}))

export const CUSTOMER_STATUS_FILTER_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]
