import type {
  PercentageType,
  RoundOffType,
} from "@/constants/price-lists"

export type PriceAdjustment = {
  percentageType: PercentageType
  percentageValue: number
  roundOffTo: RoundOffType
  decimalPlaces: number | null
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// The rate an "All Items" price list gives an item: mark the base rate up or down by the
// percentage, then round. "0.99", "0.50" and "0.49" keep the whole number and replace
// the decimals (e.g. 1104.40 → 1104.99). Never below zero.
export function applyPriceAdjustment(baseRate: number, adjustment: PriceAdjustment) {
  const factor =
    adjustment.percentageType === "Markup"
      ? 1 + adjustment.percentageValue / 100
      : 1 - adjustment.percentageValue / 100
  const adjusted = Math.max(0, baseRate * factor)

  switch (adjustment.roundOffTo) {
    case "Nearest whole number":
      return Math.round(adjusted)
    case "0.99":
    case "0.50":
    case "0.49":
      return Math.floor(adjusted) + Number(adjustment.roundOffTo)
    case "Decimal Places":
      return roundTo(adjusted, adjustment.decimalPlaces ?? 2)
    default:
      return roundTo(adjusted, 2)
  }
}

// "Markup 10%"
export function describeAdjustment(type: PercentageType | null, value: number | null) {
  return type && value !== null ? `${type} ${value}%` : null
}
