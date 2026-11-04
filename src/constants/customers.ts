import type { Enums } from "@/types/database"

export type CustomerType = Enums<"customer_type">
export type GstTreatment = Enums<"gst_treatment">

export const CUSTOMER_TYPES = ["Business", "Individual"] as const satisfies readonly CustomerType[]

export const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Miss.", "Dr."]

export const CUSTOMER_LANGUAGES = [
  "English",
  "Hindi",
  "Bengali",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Marathi",
  "Tamil",
  "Telugu",
] as const

export const GST_TREATMENTS = [
  "Registered Business - Regular",
  "Registered Business - Composition",
  "Unregistered Business",
  "Consumer",
  "Overseas",
  "Special Economic Zone",
  "Deemed Export",
  "Tax Deductor",
  "SEZ Developer",
] as const satisfies readonly GstTreatment[]

export const GST_TREATMENT_DESCRIPTIONS: Record<GstTreatment, string> = {
  "Registered Business - Regular": "A business registered under GST.",
  "Registered Business - Composition": "A business registered under the Composition Scheme.",
  "Unregistered Business": "A business not registered under GST.",
  Consumer: "A customer who is a regular consumer.",
  Overseas: "Exports outside India.",
  "Special Economic Zone": "A business in a Special Economic Zone (SEZ) or an SEZ developer.",
  "Deemed Export": "Supplies to EOUs and similar units.",
  "Tax Deductor": "Departments of State/Central government and similar.",
  "SEZ Developer": "A person or organisation who owns at least 26% equity in an SEZ.",
}

// Treatments that don't need a GSTIN; every other one does.
export const GST_TREATMENTS_WITHOUT_GSTIN: readonly GstTreatment[] = [
  "Unregistered Business",
  "Consumer",
  "Overseas",
]

// Indian states and union territories. `code` is the GST state code (the first two digits
// of a GSTIN), stored as the Place of Supply; `short` is the letter code shown with it,
// like Zoho's "[WB] West Bengal".
export const INDIAN_STATES = [
  { code: "01", short: "JK", name: "Jammu and Kashmir" },
  { code: "02", short: "HP", name: "Himachal Pradesh" },
  { code: "03", short: "PB", name: "Punjab" },
  { code: "04", short: "CH", name: "Chandigarh" },
  { code: "05", short: "UK", name: "Uttarakhand" },
  { code: "06", short: "HR", name: "Haryana" },
  { code: "07", short: "DL", name: "Delhi" },
  { code: "08", short: "RJ", name: "Rajasthan" },
  { code: "09", short: "UP", name: "Uttar Pradesh" },
  { code: "10", short: "BR", name: "Bihar" },
  { code: "11", short: "SK", name: "Sikkim" },
  { code: "12", short: "AR", name: "Arunachal Pradesh" },
  { code: "13", short: "NL", name: "Nagaland" },
  { code: "14", short: "MN", name: "Manipur" },
  { code: "15", short: "MZ", name: "Mizoram" },
  { code: "16", short: "TR", name: "Tripura" },
  { code: "17", short: "ML", name: "Meghalaya" },
  { code: "18", short: "AS", name: "Assam" },
  { code: "19", short: "WB", name: "West Bengal" },
  { code: "20", short: "JH", name: "Jharkhand" },
  { code: "21", short: "OD", name: "Odisha" },
  { code: "22", short: "CG", name: "Chhattisgarh" },
  { code: "23", short: "MP", name: "Madhya Pradesh" },
  { code: "24", short: "GJ", name: "Gujarat" },
  { code: "26", short: "DH", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", short: "MH", name: "Maharashtra" },
  { code: "29", short: "KA", name: "Karnataka" },
  { code: "30", short: "GA", name: "Goa" },
  { code: "31", short: "LD", name: "Lakshadweep" },
  { code: "32", short: "KL", name: "Kerala" },
  { code: "33", short: "TN", name: "Tamil Nadu" },
  { code: "34", short: "PY", name: "Puducherry" },
  { code: "35", short: "AN", name: "Andaman and Nicobar Islands" },
  { code: "36", short: "TS", name: "Telangana" },
  { code: "37", short: "AP", name: "Andhra Pradesh" },
  { code: "38", short: "LA", name: "Ladakh" },
  { code: "97", short: "OT", name: "Other Territory" },
] as const

export function stateName(code: string | null | undefined) {
  return INDIAN_STATES.find((state) => state.code === code)?.name
}

// "[WB] West Bengal" for a stored Place of Supply code.
export function formatPlaceOfSupply(code: string | null | undefined) {
  const state = INDIAN_STATES.find((entry) => entry.code === code)
  return state ? `[${state.short}] ${state.name}` : undefined
}

export const PAYMENT_TERMS = [
  "Due on Receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "Due end of the month",
  "Due end of next month",
] as const

export const DEFAULT_COUNTRY = "India"

// Customer imports are sent to the server in batches of this many rows (and no more).
export const CUSTOMER_IMPORT_BATCH_SIZE = 250
