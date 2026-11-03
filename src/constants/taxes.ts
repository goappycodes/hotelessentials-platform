import type { Enums } from "@/types/database"

export type TaxScope = Enums<"tax_scope">

export const TAX_SCOPES = ["Intra-state", "Inter-state"] as const satisfies readonly TaxScope[]

export const TAX_SCOPE_DESCRIPTIONS: Record<TaxScope, string> = {
  "Intra-state": "Sales within your state: CGST + SGST",
  "Inter-state": "Sales to other states: IGST",
}
