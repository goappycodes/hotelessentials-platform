// Quotations sent to the server at a time by a CSV import. Each is saved on its own, so
// this keeps one request short.
export const QUOTATION_IMPORT_BATCH_SIZE = 25

// Files attached to quotations (Zoho: up to 10 files, 10 MB each).
export const QUOTATION_ATTACHMENTS_BUCKET = "quotation-attachments"
export const MAX_QUOTATION_ATTACHMENTS = 10
export const MAX_QUOTATION_ATTACHMENT_BYTES = 10 * 1024 * 1024

// Same list as the storage bucket's allowed types.
export const QUOTATION_ATTACHMENT_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]

// For the file picker; some browsers give CSV files no type, so extensions are listed too.
export const QUOTATION_ATTACHMENT_ACCEPT = [
  ...QUOTATION_ATTACHMENT_TYPES,
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
].join(",")

// Terms & Conditions a new quotation starts with.
export const DEFAULT_QUOTATION_TERMS = [
  "1. Packing & Forwarding: Rates are inclusive of delivery till Ex- Siliguri.",
  "2. Payment Terms: 80% advance payment required; the remaining 20% payable before delivery.",
  "3. Validity: Quotation is valid for 15 days from the date of issue.",
  "4. Delivery: Estimated delivery timeline will be confirmed upon order confirmation",
].join("\n")

export const DEFAULT_ADJUSTMENT_LABEL = "Adjustment"

// The business's logo and signature stamp, printed on quotations.
export const COMPANY_ASSETS_BUCKET = "company-assets"
export const COMPANY_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"]
export const MAX_COMPANY_IMAGE_BYTES = 2 * 1024 * 1024
