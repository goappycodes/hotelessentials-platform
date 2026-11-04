// The quotation as the customer sees it, laid out like the Zoho quote template: the
// business's details, Bill To, the items with their GST split, totals in figures and
// words, bank details, terms and a signature box. Shown beside the list and on the print
// page (print it or save it as PDF). No hooks, so it renders on the server or the client.
import { INDIAN_STATES } from "@/constants/customers"
import type { QuotationDocumentData } from "@/features/quotations/queries"
import { amountInWords } from "@/lib/amount-in-words"
import { formatCurrency, formatDay, formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"

const numberFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const amount = (value: number) => numberFormat.format(value)
const percent = (value: number) => `${Number(value.toFixed(2))}%`

const RIBBON_CLASS: Record<string, string> = {
  Draft: "bg-neutral-500",
  Sent: "bg-blue-600",
  Accepted: "bg-emerald-600",
  Declined: "bg-red-600",
  Expired: "bg-amber-600",
}

type Line = QuotationDocumentData["lines"][number]
type LineTax = { cgst: number; sgst: number; igst: number }

// How a line's GST splits. From the tax rate when it still exists, else from the name
// and rate saved on the line (IGST… is inter-state; anything else splits in half).
function lineTax(line: Line): LineTax {
  if (line.tax) {
    return line.tax.tax_scope === "Intra-state"
      ? { cgst: line.tax.cgst_rate ?? 0, sgst: line.tax.sgst_rate ?? 0, igst: 0 }
      : { cgst: 0, sgst: 0, igst: line.tax.igst_rate ?? 0 }
  }
  const rate = line.tax_rate ?? 0
  if (!rate) return { cgst: 0, sgst: 0, igst: 0 }
  return line.tax_name?.toUpperCase().startsWith("IGST")
    ? { cgst: 0, sgst: 0, igst: rate }
    : { cgst: rate / 2, sgst: rate / 2, igst: 0 }
}

function placeOfSupplyLabel(code: string | null) {
  if (!code) return null
  const state = INDIAN_STATES.find((entry) => entry.code === code)
  return state ? `${state.name} (${code})` : code
}

export function QuotationDocument({
  data,
  isExpired = false,
  className,
}: {
  data: QuotationDocumentData
  isExpired?: boolean
  className?: string
}) {
  const { quote, lines, customer, company } = data
  const status = isExpired && quote.status !== "Accepted" && quote.status !== "Declined"
    ? "Expired"
    : quote.status

  // A whole-quote discount before tax lowers every line's taxable value by the same share.
  const transactionDiscount = quote.discount_level === "Transaction" ? quote.discount_total : 0
  const taxableShare =
    transactionDiscount > 0 && quote.is_discount_before_tax && quote.sub_total > 0
      ? (quote.sub_total - transactionDiscount) / quote.sub_total
      : 1

  const rows = lines.map((line) => {
    const tax = lineTax(line)
    const taxable = line.amount * taxableShare
    return {
      line,
      tax,
      cgstAmount: (taxable * tax.cgst) / 100,
      sgstAmount: (taxable * tax.sgst) / 100,
      igstAmount: (taxable * tax.igst) / 100,
    }
  })
  const showIntra = rows.some((row) => row.tax.cgst > 0 || row.tax.sgst > 0)
  const showInter = rows.some((row) => row.tax.igst > 0)

  // Tax totals per component and rate, e.g. "CGST9 (9%)".
  const taxSummary = new Map<string, number>()
  const addTax = (label: string, value: number) =>
    taxSummary.set(label, (taxSummary.get(label) ?? 0) + value)
  rows.forEach((row) => {
    if (row.tax.cgst) addTax(`CGST${Number(row.tax.cgst.toFixed(2))} (${percent(row.tax.cgst)})`, row.cgstAmount)
    if (row.tax.sgst) addTax(`SGST${Number(row.tax.sgst.toFixed(2))} (${percent(row.tax.sgst)})`, row.sgstAmount)
    if (row.tax.igst) addTax(`IGST${Number(row.tax.igst.toFixed(2))} (${percent(row.tax.igst)})`, row.igstAmount)
  })

  const companyLines = [
    ...(company?.address?.split("\n") ?? []),
    company?.phone,
    company?.email,
  ].filter((line): line is string => Boolean(line?.trim()))

  const billingLines = customer
    ? [
        customer.billing_attention,
        customer.billing_street1,
        customer.billing_street2,
        [customer.billing_city, customer.billing_pin_code].filter(Boolean).join(" "),
        [customer.billing_state, customer.billing_country].filter(Boolean).join(", "),
        customer.billing_phone && `Phone: ${customer.billing_phone}`,
      ].filter((line): line is string => Boolean(line?.trim()))
    : []

  const details: [string, string | null][] = [
    ["Quotation No", quote.quote_number],
    ["Quote Date", formatDay(quote.quote_date)],
    ["Expiry Date", quote.expiry_date ? formatDay(quote.expiry_date) : null],
    ["Reference#", quote.reference_number],
    ["Salesperson", data.salespersonName],
  ]

  const cell = "border-neutral-400 px-1.5 py-1 align-top"
  const head = "border-neutral-400 bg-neutral-100 px-1.5 py-1 font-semibold"

  return (
    <article
      aria-label={`Quotation ${quote.quote_number}`}
      className={cn(
        "relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white p-[8mm] font-serif text-[11px] leading-snug text-neutral-900",
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-5 -left-10 w-36 -rotate-45 py-1 text-center font-sans text-xs font-medium text-white",
          RIBBON_CLASS[status] ?? "bg-neutral-500"
        )}
      >
        {status}
      </div>

      <div className="border border-neutral-500">
        {/* The business */}
        <header className="border-b border-neutral-500 px-4 py-3 pl-10">
          <p className="text-base font-bold uppercase">{company?.company_name || "Your company"}</p>
          {companyLines.map((line, index) => (
            <p key={index} className="text-[10px] text-neutral-700">
              {line}
            </p>
          ))}
          {company?.gstin && <p className="text-[10px] text-neutral-700">GSTIN: {company.gstin}</p>}
        </header>

        {/* Quote details and place of supply */}
        <div className="grid grid-cols-2 border-b border-neutral-500">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-0.5 border-r border-neutral-500 px-2 py-1.5">
            {details
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-neutral-600">{label}</dt>
                  <dd className="font-semibold">: {value}</dd>
                </div>
              ))}
          </dl>
          <dl className="grid grid-cols-[7rem_1fr] content-start gap-x-2 px-2 py-1.5">
            <dt className="text-neutral-600">Place Of Supply</dt>
            <dd className="font-semibold">: {placeOfSupplyLabel(quote.place_of_supply) ?? "—"}</dd>
          </dl>
        </div>

        {/* The customer */}
        <div className="border-b border-neutral-500 bg-neutral-100 px-2 py-0.5 font-semibold">
          Bill To
        </div>
        <div className="border-b border-neutral-500 px-2 py-1.5">
          <p className="font-semibold text-blue-700">{customer?.display_name ?? quote.customer_name}</p>
          {customer?.company_name && customer.company_name !== customer.display_name && (
            <p>{customer.company_name}</p>
          )}
          {billingLines.map((line, index) => (
            <p key={index} className="text-[10px]">
              {line}
            </p>
          ))}
          {customer?.gstin && <p className="text-[10px]">GSTIN: {customer.gstin}</p>}
        </div>

        {quote.subject && (
          <div className="border-b border-neutral-500 px-2 py-1.5">
            <span className="text-neutral-600">Subject: </span>
            {quote.subject}
          </div>
        )}

        {/* The items */}
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th rowSpan={2} className={cn(head, "w-6 border-r border-b text-left")}>#</th>
              <th rowSpan={2} className={cn(head, "border-r border-b text-left")}>Item &amp; Description</th>
              <th rowSpan={2} className={cn(head, "w-14 border-r border-b text-right")}>Qty</th>
              <th rowSpan={2} className={cn(head, "w-16 border-r border-b text-right")}>Rate</th>
              {showIntra && (
                <>
                  <th colSpan={2} className={cn(head, "border-r border-b text-center")}>CGST</th>
                  <th colSpan={2} className={cn(head, "border-r border-b text-center")}>SGST</th>
                </>
              )}
              {showInter && (
                <th colSpan={2} className={cn(head, "border-r border-b text-center")}>IGST</th>
              )}
              <th rowSpan={2} className={cn(head, "w-20 border-b text-right")}>Amount</th>
            </tr>
            <tr>
              {[...(showIntra ? ["CGST", "SGST"] : []), ...(showInter ? ["IGST"] : [])].map((tax) => (
                <TaxHead key={tax} className={head} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ line, tax, cgstAmount, sgstAmount, igstAmount }, index) => (
              <tr key={line.id} className="break-inside-avoid">
                <td className={cn(cell, "border-r border-b")}>{index + 1}</td>
                <td className={cn(cell, "border-r border-b")}>
                  <p className="font-medium">{line.name}</p>
                  {line.description && (
                    <p className="whitespace-pre-line text-neutral-600">{line.description}</p>
                  )}
                  {line.hsn_code && <p className="mt-1 text-neutral-600">HSN: {line.hsn_code}</p>}
                </td>
                <td className={cn(cell, "border-r border-b text-right")}>
                  {formatQuantity(line.quantity, line.unit)}
                </td>
                <td className={cn(cell, "border-r border-b text-right")}>{amount(line.rate)}</td>
                {showIntra && (
                  <>
                    <TaxCells rate={tax.cgst} value={cgstAmount} className={cell} />
                    <TaxCells rate={tax.sgst} value={sgstAmount} className={cell} />
                  </>
                )}
                {showInter && <TaxCells rate={tax.igst} value={igstAmount} className={cell} />}
                <td className={cn(cell, "border-b text-right")}>{amount(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Words, bank details and terms; totals and signature */}
        <div className="grid grid-cols-[1fr_16rem] break-inside-avoid">
          <div className="flex flex-col gap-3 border-r border-neutral-500 px-2 py-2">
            <div>
              <p className="text-neutral-600">Total In Words</p>
              <p className="font-semibold italic">{amountInWords(quote.total)}</p>
            </div>
            {quote.notes && (
              <div>
                <p className="text-neutral-600">Notes</p>
                <p className="whitespace-pre-line">{quote.notes}</p>
              </div>
            )}
            {company?.bank_details && (
              <div>
                <p className="font-semibold">BANK DETAILS</p>
                <p className="whitespace-pre-line">{company.bank_details}</p>
              </div>
            )}
            {quote.terms && (
              <div>
                <p className="text-neutral-600">Terms &amp; Conditions</p>
                <p className="whitespace-pre-line">{quote.terms}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-neutral-500 px-2 py-2 text-right">
              <dt>Sub Total</dt>
              <dd>{amount(quote.sub_total)}</dd>
              {transactionDiscount > 0 && (
                <>
                  <dt>Discount</dt>
                  <dd>(−) {amount(transactionDiscount)}</dd>
                </>
              )}
              {[...taxSummary].map(([label, value]) => (
                <div key={label} className="contents">
                  <dt>{label}</dt>
                  <dd>{amount(value)}</dd>
                </div>
              ))}
              {quote.adjustment !== 0 && (
                <>
                  <dt>{quote.adjustment_description || "Adjustment"}</dt>
                  <dd>{amount(quote.adjustment)}</dd>
                </>
              )}
              <dt className="font-bold">Total</dt>
              <dd className="font-bold">{formatCurrency(quote.total)}</dd>
            </dl>
            <div className="flex min-h-28 flex-1 items-end justify-center px-2 pb-2">
              <p>Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function TaxHead({ className }: { className: string }) {
  return (
    <>
      <th className={cn(className, "w-9 border-r border-b text-right")}>%</th>
      <th className={cn(className, "w-14 border-r border-b text-right")}>Amt</th>
    </>
  )
}

function TaxCells({ rate, value, className }: { rate: number; value: number; className: string }) {
  return (
    <>
      <td className={cn(className, "border-r border-b text-right")}>{rate ? percent(rate) : ""}</td>
      <td className={cn(className, "border-r border-b text-right")}>{rate ? amount(value) : ""}</td>
    </>
  )
}
