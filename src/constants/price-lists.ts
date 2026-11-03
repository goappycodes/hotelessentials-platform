import type { Enums } from "@/types/database"

export type TransactionType = Enums<"transaction_type">
export type PriceListType = Enums<"price_list_type">
export type PercentageType = Enums<"percentage_type">
export type RoundOffType = Enums<"round_off_type">

export const TRANSACTION_TYPES = ["Sales", "Purchase"] as const satisfies readonly TransactionType[]

export const PRICE_LIST_TYPES = [
  "All Items",
  "Individual Items",
] as const satisfies readonly PriceListType[]

export const PRICE_LIST_TYPE_DESCRIPTIONS: Record<PriceListType, string> = {
  "All Items": "Mark up or mark down the rates of all items by a percentage.",
  "Individual Items": "Set a custom rate for each item.",
}

export const PERCENTAGE_TYPES = ["Markup", "Markdown"] as const satisfies readonly PercentageType[]

export const ROUND_OFF_TYPES = [
  "Never mind",
  "Nearest whole number",
  "0.99",
  "0.50",
  "0.49",
  "Decimal Places",
] as const satisfies readonly RoundOffType[]

export const ROUND_OFF_LABELS: Record<RoundOffType, string> = {
  "Never mind": "Never mind",
  "Nearest whole number": "Nearest whole number",
  "0.99": "0.99",
  "0.50": "0.50",
  "0.49": "0.49",
  "Decimal Places": "Decimal places",
}

export const DECIMAL_PLACES = ["0", "1", "2", "3", "4"] as const
