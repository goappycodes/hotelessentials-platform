import type { Tables } from "@/types/database"

export type TaxRate = Pick<
  Tables<"tax_rates">,
  "id" | "name" | "tax_scope" | "cgst_rate" | "sgst_rate" | "igst_rate" | "rate" | "is_active"
>

export const TAX_RATE_COLUMNS =
  "id, name, tax_scope, cgst_rate, sgst_rate, igst_rate, rate, is_active" as const

function percent(value: number | null) {
  return `${value ?? 0}%`
}

// "GST18 [18%]"
export function formatTaxName(tax: TaxRate) {
  return `${tax.name} [${percent(tax.rate)}]`
}

// "CGST 9% + SGST 9%" or "IGST 18%"
export function formatTaxBreakdown(tax: TaxRate) {
  return tax.tax_scope === "Intra-state"
    ? `CGST ${percent(tax.cgst_rate)} + SGST ${percent(tax.sgst_rate)}`
    : `IGST ${percent(tax.igst_rate)}`
}
