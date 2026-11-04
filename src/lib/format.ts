// Amounts are stored with up to 4 decimal places (numeric(15, 4)).
export const MONEY_DECIMALS = 4

// At least 2 decimals (₹1,200.00) and up to 4 when the amount has them (₹99.982).
const currencyFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: MONEY_DECIMALS,
})

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

export function formatCurrency(value: number) {
  return currencyFormat.format(value)
}

export function formatDate(value: string) {
  return dateFormat.format(new Date(value))
}

// Money as entered in forms: digits with up to 4 decimals, e.g. "1200", "99.5" or "99.982".
export const MONEY_PATTERN = /^\d{1,11}(\.\d{1,4})?$/

export const MONEY_PATTERN_MESSAGE = "Enter an amount like 1200, 99.50 or 99.982 (up to 4 decimals)"

// The stored amount as the form shows it, without losing decimals (99.982 stays 99.982).
export function toMoneyInput(value: number) {
  return String(value)
}

// Stock quantities as entered in forms: like money, up to 4 decimals (2.5 kg).
export const QUANTITY_PATTERN = /^\d{1,11}(\.\d{1,4})?$/

const quantityFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: MONEY_DECIMALS })

// A stock quantity with its unit when known: "1,250 pcs", "2.5 kg".
export function formatQuantity(value: number, unit?: string | null) {
  const amount = quantityFormat.format(value)
  return unit ? `${amount} ${unit}` : amount
}

// A stock change with its sign: "+10 pcs", "−2.5 kg".
export function formatSignedQuantity(value: number, unit?: string | null) {
  return `${value > 0 ? "+" : "−"}${formatQuantity(Math.abs(value), unit)}`
}

// A date without a time (YYYY-MM-DD), read as that day locally rather than UTC midnight.
export function formatDay(value: string) {
  return dateFormat.format(new Date(`${value}T00:00:00`))
}
