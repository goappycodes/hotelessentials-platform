const currencyFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
})

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

export function formatCurrency(value: number) {
  return currencyFormat.format(value)
}

export function formatDate(value: string) {
  return dateFormat.format(new Date(value))
}

// Money as entered in forms: digits with up to two decimals, e.g. "1200" or "99.5".
export const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/

export function toMoneyInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
