// An amount in words the Indian way (lakh, crore), as printed on quotes and invoices:
// 14407.78 → "Indian Rupee Fourteen Thousand Four Hundred Seven and Seventy-Eight Paise Only".

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
  "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function belowHundred(value: number) {
  if (value < 20) return ONES[value]
  const ones = value % 10
  return ones ? `${TENS[Math.floor(value / 10)]}-${ONES[ones]}` : TENS[Math.floor(value / 10)]
}

function belowThousand(value: number) {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""]
    .filter(Boolean)
    .join(" ")
}

// Whole numbers: crore (10,000,000), lakh (100,000), thousand, then the rest.
function wholeInWords(value: number): string {
  if (value === 0) return "Zero"
  const parts: string[] = []
  const crore = Math.floor(value / 10_000_000)
  if (crore) parts.push(`${wholeInWords(crore)} Crore`)
  let rest = value % 10_000_000
  const lakh = Math.floor(rest / 100_000)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  rest %= 100_000
  const thousand = Math.floor(rest / 1000)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  rest %= 1000
  if (rest) parts.push(belowThousand(rest))
  return parts.join(" ")
}

export function amountInWords(amount: number) {
  const paiseTotal = Math.round(Math.abs(amount) * 100)
  const rupees = Math.floor(paiseTotal / 100)
  const paise = paiseTotal % 100
  const sign = amount < 0 ? "Minus " : ""
  const words = `${sign}Indian Rupee ${wholeInWords(rupees)}`
  return paise ? `${words} and ${belowHundred(paise)} Paise Only` : `${words} Only`
}
