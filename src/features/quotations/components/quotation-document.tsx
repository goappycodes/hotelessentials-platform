// The quotation as the customer sees it, measured from the business's own PDF: logo and
// company details, To, the items with a picture, code and GST %, totals in figures and
// words, then bank details and terms. Sizes are in points, so print matches the PDF (A4,
// 13pt / 26pt margins). Shown beside the list and on the print page (print or save as
// PDF). No hooks, so it renders on the server or the client.
/* eslint-disable @next/next/no-img-element -- signed storage URLs, printed as they are */
import type { QuotationDocumentData } from "@/features/quotations/queries"
import { amountInWords } from "@/lib/amount-in-words"
import { cn } from "@/lib/utils"

const numberFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const money = (value: number) => `₹ ${numberFormat.format(value)}`

// 04-11-2026
function formatQuoteDate(value: string) {
  const [year, month, day] = value.split("-")
  return `${day}-${month}-${year}`
}

const RIBBON_CLASS: Record<string, string> = {
  Draft: "bg-[#7d8b8c]",
  Sent: "bg-[#4a8bd6]",
  Accepted: "bg-[#3aa76d]",
  Declined: "bg-[#d0453c]",
  Expired: "bg-[#d48a2c]",
}

// Column widths in points, in order; they add up to the page's 543.28pt.
const COLUMNS = [
  { label: "S.No.", width: "32.5pt" },
  { label: "Image", width: "76pt" },
  { label: "Code", width: "79.8pt" },
  { label: "Name", width: "158.8pt" },
  { label: "Qty", width: "43.4pt" },
  { label: "Selling Rate", width: "59.7pt" },
  { label: "Taxable Amount", width: "59.7pt" },
  { label: "GST", width: "32.5pt" },
]

const HEAD_CELL =
  "h-[22.8pt] border border-black bg-[#1877f2] p-0 text-center align-middle text-[7pt] font-normal text-white"
const CELL = "h-[67pt] border border-black p-0 text-center align-middle"
const SUMMARY_LABEL = "h-[20.8pt] w-[178.9pt] border border-black px-[6pt] text-right font-bold"
const SUMMARY_VALUE = "h-[20.8pt] border border-black px-[6pt] text-right"

const lines = (text: string | null | undefined) =>
  (text ?? "").split("\n").filter((line) => line.trim())

// Numbered terms, one to an entry: a line that doesn't start a number carries on the one
// before it (Zoho's text breaks mid-sentence), so each entry flows to the column's width.
function termEntries(text: string | null | undefined) {
  const entries: string[] = []
  const all = lines(text)
  const isNumbered = all.some((line) => /^\d+[.)]/.test(line.trim()))
  for (const line of all) {
    const startsEntry = !isNumbered || /^\d+[.)]/.test(line.trim())
    if (startsEntry || entries.length === 0) entries.push(line.trim())
    else entries[entries.length - 1] += ` ${line.trim()}`
  }
  return entries
}

// A name starting with its own code doesn't repeat it: "[1P00415] Soda Cup" → "Soda Cup".
function nameWithoutCode(name: string, sku: string | null | undefined) {
  if (!sku) return name
  const prefix = `[${sku}]`
  return name.startsWith(prefix) ? name.slice(prefix.length).trim() : name
}

export function QuotationDocument({
  data,
  isExpired = false,
  showStatus = true,
  className,
}: {
  data: QuotationDocumentData
  isExpired?: boolean
  // The status ribbon in the corner; off for the copy that goes to the customer.
  showStatus?: boolean
  className?: string
}) {
  const { quote, customer, company } = data
  const status =
    isExpired && quote.status !== "Accepted" && quote.status !== "Declined"
      ? "Expired"
      : quote.status

  const transactionDiscount = quote.discount_level === "Transaction" ? quote.discount_total : 0

  const firstAddress = [
    ...lines(company?.address),
    company?.gstin && `GST NO : ${company.gstin}`,
    company?.pan && `PAN No : ${company.pan}`,
    company?.email && `Email : ${company.email}`,
    company?.phone && `Contact No. : ${company.phone}`,
  ].filter((line): line is string => Boolean(line))

  const billingLines = customer
    ? [
        customer.billing_attention,
        customer.billing_street1,
        customer.billing_street2,
        [customer.billing_city, customer.billing_pin_code].filter(Boolean).join(" "),
        customer.billing_state,
      ].filter((line): line is string => Boolean(line?.trim()))
    : []

  return (
    <article
      aria-label={`Quotation ${quote.quote_number}`}
      className={cn(
        "relative mx-auto w-[595.28pt] max-w-full overflow-hidden bg-white px-[26pt] py-[13pt] font-(family-name:--font-document) text-[7.5pt] leading-[11.25pt] text-[#151826] [print-color-adjust:exact]",
        className
      )}
    >
      {showStatus && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute top-[14px] -left-[46px] w-40 -rotate-45 py-1 text-center font-sans text-xs text-white print:hidden",
            RIBBON_CLASS[status] ?? RIBBON_CLASS.Draft
          )}
        >
          {status}
        </div>
      )}

      <header className="relative h-[124pt] border-b-[1.5pt] border-[#9ca3af]">
        <h1 className="mb-[12.25pt] text-[19pt] leading-[22pt] font-bold text-[#40535c] uppercase">
          {company?.company_name || "Your company"}
        </h1>
        <div className="flex">
          <div className="w-[219.9pt] shrink-0">
            {firstAddress.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
          <div>
            {lines(company?.address_2).map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </div>
        {data.logoUrl && (
          <img
            src={data.logoUrl}
            alt={company?.company_name ?? "Logo"}
            className="absolute top-0 right-[3.8pt] h-[57pt] w-[134.4pt] object-contain object-right"
          />
        )}
        <dl className="absolute top-[73.4pt] right-0 text-right leading-[11.7pt]">
          <div>
            <dt className="inline">Date: </dt>
            <dd className="inline">{formatQuoteDate(quote.quote_date)}</dd>
          </div>
          <div>
            <dt className="inline">Quotation No: </dt>
            <dd className="inline">{quote.quote_number}</dd>
          </div>
        </dl>
      </header>

      <section className="pt-[12.3pt] text-[8.5pt] leading-[9.5pt]">
        <p className="mb-[2.1pt] font-bold">To,</p>
        <p className="text-[11pt] leading-[13pt] font-bold">
          {customer?.display_name ?? quote.customer_name}
        </p>
        {billingLines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
        {customer?.gstin && <p>GST No : {customer.gstin}</p>}
      </section>

      <h2 className="mt-[14.3pt] mb-[3.3pt] text-center text-[14pt] leading-[16pt] font-bold">
        Quotation
      </h2>

      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.label} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="break-inside-avoid">
            {COLUMNS.map((column) => (
              <th key={column.label} className={HEAD_CELL}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, index) => {
            const sku = line.item?.sku
            return (
              <tr key={line.id} className="break-inside-avoid">
                <td className={CELL}>{index + 1}</td>
                <td className={CELL}>
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt=""
                      className="mx-auto max-h-[56pt] max-w-[56pt] object-contain"
                    />
                  ) : (
                    <div className="mx-auto flex size-[56pt] items-center justify-center bg-[#f3f4f6] text-[7pt] text-[#9ca3af]">
                      No image
                    </div>
                  )}
                </td>
                <td className={cn(CELL, "px-[2pt] break-words")}>{sku}</td>
                <td className={cn(CELL, "px-[4pt] text-left leading-[9.75pt]")}>
                  {nameWithoutCode(line.name, sku)}
                  {line.description && line.description !== line.name && (
                    <span className="block whitespace-pre-line text-[#555]">{line.description}</span>
                  )}
                </td>
                <td className={CELL}>{numberFormat.format(line.quantity)}</td>
                {/* What each one sells for after any discount, so Qty × Rate = Taxable. */}
                <td className={CELL}>{money(line.amount / line.quantity)}</td>
                <td className={CELL}>{money(line.amount)}</td>
                <td className={CELL}>{(line.tax_rate ?? 0).toFixed(1)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <table className="mt-[14pt] w-full border-collapse break-inside-avoid">
        <tbody>
          <tr>
            <th className={SUMMARY_LABEL}>Taxable amount</th>
            <td className={SUMMARY_VALUE}>{money(quote.sub_total)}</td>
          </tr>
          {transactionDiscount > 0 && (
            <tr>
              <th className={SUMMARY_LABEL}>Discount</th>
              <td className={SUMMARY_VALUE}>- {money(transactionDiscount)}</td>
            </tr>
          )}
          <tr>
            <th className={SUMMARY_LABEL}>GST</th>
            <td className={SUMMARY_VALUE}>{money(quote.tax_total)}</td>
          </tr>
          {quote.adjustment !== 0 && (
            <tr>
              <th className={SUMMARY_LABEL}>{quote.adjustment_description || "Adjustment"}</th>
              <td className={SUMMARY_VALUE}>{money(quote.adjustment)}</td>
            </tr>
          )}
          <tr>
            <th className={cn(SUMMARY_LABEL, "bg-[#f3f4f6]")}>Total</th>
            <td className={cn(SUMMARY_VALUE, "font-bold")}>{money(quote.total)}</td>
          </tr>
          <tr>
            <th className={cn(SUMMARY_LABEL, "bg-[#f9fafb] text-left")}>
              Total Quotation Amount in Words
            </th>
            <td className={cn(SUMMARY_VALUE, "text-left font-bold")}>
              {amountInWords(quote.total)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-[283.6pt_266.5pt] pt-[37pt] text-[8.5pt] break-inside-avoid">
        <section className="leading-[12.75pt]">
          {lines(company?.bank_details).length > 0 && (
            <h3 className="mb-[3.5pt] text-[11pt] leading-[13pt] font-bold">BANK DETAILS :</h3>
          )}
          {lines(company?.bank_details).map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </section>
        <section className="leading-[9.75pt]">
          {quote.terms && (
            <h3 className="mb-[5pt] text-[11pt] leading-[13pt] font-bold">Terms &amp; Conditions:</h3>
          )}
          {termEntries(quote.terms).map((entry, index) => (
            <p key={index} className="mb-[4pt]">
              {entry}
            </p>
          ))}
        </section>
      </div>

      {quote.notes && (
        <section className="mt-[12pt] text-[8.5pt] leading-[11pt] break-inside-avoid">
          <h3 className="mb-[2pt] text-[11pt] leading-[13pt] font-bold">Notes:</h3>
          <p className="whitespace-pre-line">{quote.notes}</p>
        </section>
      )}
    </article>
  )
}
