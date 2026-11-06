import type { ListConfig } from "@/constants/list"

export const SALES_ORDER_STATUSES = ["Draft", "Confirmed", "Closed"] as const

export const SALES_ORDERS_LIST: ListConfig = {
  sortOptions: [
    { value: "so_number", label: "Sales Order Number" },
    { value: "order_date", label: "Date" },
    { value: "quote_number", label: "Quote Number" },
    { value: "customer_name", label: "Customer Name" },
    { value: "total", label: "Amount" },
    { value: "created_at", label: "Created Time" },
    { value: "updated_at", label: "Last Modified Time" },
  ],
  // Numbers follow the dates, and unlike dates they never tie, so pages stay stable.
  defaultSort: "so_number",
  defaultOrder: "desc",
  filters: { status: SALES_ORDER_STATUSES },
  search: { columns: ["so_number", "quote_number", "reference_number", "customer_name", "subject"] },
}

// The Status menu on an opened sales order.
export const SALES_ORDER_STATUS_ACTIONS: {
  status: (typeof SALES_ORDER_STATUSES)[number]
  label: string
  done: string
}[] = [
  { status: "Confirmed", label: "Mark as Confirmed", done: "Sales order confirmed." },
  { status: "Closed", label: "Mark as Closed", done: "Sales order closed." },
  { status: "Draft", label: "Back to Draft", done: "Sales order moved back to draft." },
]

export const SALES_ORDER_STATUS_FILTER_OPTIONS = SALES_ORDER_STATUSES.map((status) => ({
  value: status,
  label: status,
}))

export const SALES_ORDER_COLUMNS = [
  "Date",
  "Sales Order",
  "Quote Number",
  "Customer Name",
  "Status",
  "Amount",
]
