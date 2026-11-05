import type { ListConfig } from "@/constants/list"

export const QUOTATION_STATUSES = ["Draft", "Sent", "Accepted", "Declined"] as const

export const QUOTATIONS_LIST: ListConfig = {
  sortOptions: [
    { value: "quote_date", label: "Date" },
    { value: "quote_number", label: "Quote Number" },
    { value: "customer_name", label: "Customer Name" },
    { value: "total", label: "Amount" },
    { value: "created_at", label: "Created Time" },
    { value: "updated_at", label: "Last Modified Time" },
  ],
  defaultSort: "quote_date",
  defaultOrder: "desc",
  filters: { status: QUOTATION_STATUSES },
  search: { columns: ["quote_number", "reference_number", "customer_name", "subject"] },
}

// The Status menu on an opened quotation.
export const STATUS_ACTIONS: {
  status: (typeof QUOTATION_STATUSES)[number]
  label: string
  done: string
}[] = [
  { status: "Sent", label: "Mark as Sent", done: "Quotation marked as sent." },
  { status: "Accepted", label: "Mark as Accepted", done: "Quotation marked as accepted." },
  { status: "Declined", label: "Mark as Declined", done: "Quotation marked as declined." },
  { status: "Draft", label: "Back to Draft", done: "Quotation moved back to draft." },
]

export const QUOTATION_STATUS_FILTER_OPTIONS =QUOTATION_STATUSES.map((status) => ({
  value: status,
  label: status,
}))

export const QUOTATION_COLUMNS = [
  "Date",
  "Quote Number",
  // "Reference Number",
  "Customer Name",
  "Status",
  "Amount",
]
