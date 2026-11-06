import type { ListConfig } from "@/constants/list"

export const DESPATCH_STATUSES = ["Packed", "Despatched", "Delivered"] as const

export const DESPATCH_LIST: ListConfig = {
  sortOptions: [
    { value: "despatch_number", label: "Despatch Number" },
    { value: "despatch_date", label: "Date" },
    { value: "so_number", label: "Sales Order" },
    { value: "customer_name", label: "Customer Name" },
    { value: "transporter", label: "Transporter" },
    { value: "created_at", label: "Created Time" },
    { value: "updated_at", label: "Last Modified Time" },
  ],
  // Numbers follow the dates, and unlike dates they never tie, so pages stay stable.
  defaultSort: "despatch_number",
  defaultOrder: "desc",
  filters: { status: DESPATCH_STATUSES },
  search: {
    columns: ["despatch_number", "so_number", "customer_name", "transporter", "tracking_number"],
  },
}

// The Status menu on an opened despatch.
export const DESPATCH_STATUS_ACTIONS: {
  status: (typeof DESPATCH_STATUSES)[number]
  label: string
  done: string
}[] = [
  { status: "Despatched", label: "Mark as Despatched", done: "Marked as despatched." },
  { status: "Delivered", label: "Mark as Delivered", done: "Marked as delivered." },
  { status: "Packed", label: "Back to Packed", done: "Moved back to packed." },
]

export const DESPATCH_STATUS_FILTER_OPTIONS = DESPATCH_STATUSES.map((status) => ({
  value: status,
  label: status,
}))

export const DESPATCH_COLUMNS = [
  "Date",
  "Despatch Number",
  "Sales Order",
  "Customer Name",
  "Transporter",
  "Tracking Number",
  "Status",
]
