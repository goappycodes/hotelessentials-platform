// The quotation as the customer sees it, laid out like the business's Zoho quote
// template: logo and company details, quote details and place of supply, Bill To, the
// items with their GST split, totals in figures and words, bank details, terms and the
// signature stamp. Shown beside the list and on the print page (print or save as PDF).
// No hooks, so it renders on the server or the client.
/* eslint-disable @next/next/no-img-element -- signed storage URLs, printed as they are */
import { INDIAN_STATES } from "@/constants/customers";
import type { QuotationDocumentData } from "@/features/quotations/queries";
import { amountInWords } from "@/lib/amount-in-words";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantityFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 4,
});
const amount = (value: number) => numberFormat.format(value);
const percent = (value: number) => `${Number(value.toFixed(2))}`;

// Like Zoho's quote: 04/11/2026.
function formatQuoteDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

// The template's colours.
const LABEL = "text-[#3c4f8c]";
const ACCENT = "text-[#a5372b]";
const ITEM_ACCENT = "text-[#c0561d]";
const CUSTOMER = "text-[#2257c5]";

const RIBBON_CLASS: Record<string, string> = {
  Draft: "bg-[#7d8b8c]",
  Sent: "bg-[#4a8bd6]",
  Accepted: "bg-[#3aa76d]",
  Declined: "bg-[#d0453c]",
  Expired: "bg-[#d48a2c]",
};

type Line = QuotationDocumentData["lines"][number];
type LineTax = { cgst: number; sgst: number; igst: number };

// How a line's GST splits. From the tax rate when it still exists, else from the name
// and rate saved on the line (IGST… is inter-state; anything else splits in half).
function lineTax(line: Line): LineTax {
  if (line.tax) {
    return line.tax.tax_scope === "Intra-state"
      ? {
          cgst: line.tax.cgst_rate ?? 0,
          sgst: line.tax.sgst_rate ?? 0,
          igst: 0,
        }
      : { cgst: 0, sgst: 0, igst: line.tax.igst_rate ?? 0 };
  }
  const rate = line.tax_rate ?? 0;
  if (!rate) return { cgst: 0, sgst: 0, igst: 0 };
  return line.tax_name?.toUpperCase().startsWith("IGST")
    ? { cgst: 0, sgst: 0, igst: rate }
    : { cgst: rate / 2, sgst: rate / 2, igst: 0 };
}

function placeOfSupplyLabel(code: string | null) {
  if (!code) return null;
  const state = INDIAN_STATES.find((entry) => entry.code === code);
  return state ? `${state.name} (${code})` : code;
}

const lines = (text: string | null | undefined) =>
  (text ?? "").split("\n").filter((line) => line.trim());

export function QuotationDocument({
  data,
  isExpired = false,
  showStatus = true,
  className,
}: {
  data: QuotationDocumentData;
  isExpired?: boolean;
  // The status ribbon in the corner; off for the copy that goes to the customer.
  showStatus?: boolean;
  className?: string;
}) {
  const { quote, customer, company } = data;
  const status =
    isExpired && quote.status !== "Accepted" && quote.status !== "Declined"
      ? "Expired"
      : quote.status;

  // A whole-quote discount before tax lowers every line's taxable value by the same share.
  const transactionDiscount =
    quote.discount_level === "Transaction" ? quote.discount_total : 0;
  const taxableShare =
    transactionDiscount > 0 &&
    quote.is_discount_before_tax &&
    quote.sub_total > 0
      ? (quote.sub_total - transactionDiscount) / quote.sub_total
      : 1;

  const rows = data.lines.map((line) => {
    const tax = lineTax(line);
    const taxable = line.amount * taxableShare;
    return {
      line,
      tax,
      cgstAmount: (taxable * tax.cgst) / 100,
      sgstAmount: (taxable * tax.sgst) / 100,
      igstAmount: (taxable * tax.igst) / 100,
    };
  });
  // Lines with a discount (from a price list) get a Discount column.
  const showDiscount = rows.some((row) => row.line.discount_value > 0);
  const showIntra = rows.some((row) => row.tax.cgst > 0 || row.tax.sgst > 0);
  const showInter = rows.some((row) => row.tax.igst > 0);
  const taxGroups = [
    ...(showIntra ? ["CGST", "SGST"] : []),
    ...(showInter ? ["IGST"] : []),
  ];

  // Tax totals per component and rate, e.g. "IGST18 (18%)".
  const taxSummary = new Map<string, number>();
  const addTax = (name: string, rate: number, value: number) => {
    const label = `${name}${percent(rate)} (${percent(rate)}%)`;
    taxSummary.set(label, (taxSummary.get(label) ?? 0) + value);
  };
  rows.forEach((row) => {
    if (row.tax.cgst) addTax("CGST", row.tax.cgst, row.cgstAmount);
    if (row.tax.sgst) addTax("SGST", row.tax.sgst, row.sgstAmount);
    if (row.tax.igst) addTax("IGST", row.tax.igst, row.igstAmount);
  });

  const billingLines = customer
    ? [
        customer.billing_attention,
        customer.billing_street1,
        customer.billing_street2,
        customer.billing_city,
        [customer.billing_pin_code, customer.billing_state]
          .filter(Boolean)
          .join(" "),
        customer.billing_country && customer.billing_country !== "India"
          ? customer.billing_country
          : null,
      ].filter((line): line is string => Boolean(line?.trim()))
    : [];

  const details: [string, string | null][] = [
    ["Quotation No", quote.quote_number],
    ["Quote Date", formatQuoteDate(quote.quote_date)],
    [
      "Expiry Date",
      quote.expiry_date ? formatQuoteDate(quote.expiry_date) : null,
    ],
    ["Reference#", quote.reference_number],
  ];

  const cell = "border-[#9a9a9a] px-1.5 py-1.5 align-top";
  const head = "border-[#9a9a9a] bg-[#f1f1f1] px-1.5 py-1 font-bold";

  return (
    <article
      aria-label={`Quotation ${quote.quote_number}`}
      className={cn(
        "relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white px-[9mm] py-[11mm] font-serif text-[10.5px] leading-[1.45] text-[#222] [print-color-adjust:exact]",
        className,
      )}
    >
      {showStatus && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute top-[18px] -left-[42px] w-40 -rotate-45 py-1.5 text-center font-sans text-xs text-white",
            RIBBON_CLASS[status] ?? RIBBON_CLASS.Draft,
          )}
        >
          {status}
        </div>
      )}

      <div className="border border-[#6b6b6b]">
        {/* The business */}
        <header className="flex gap-4 border-b border-[#6b6b6b] p-2.5">
          {data.logoUrl && (
            <img
              src={data.logoUrl}
              alt={company?.company_name ?? "Logo"}
              className="h-[88px] w-[88px] shrink-0 object-contain"
            />
          )}
          <div className="min-w-0 pt-0.5">
            <p className="text-[15px] leading-tight font-bold uppercase">
              {company?.company_name || "Hotel Essentials"}
            </p>
            {lines(company?.address).map((line, index) => (
              <p key={index} className={cn("text-[9.5px]", ACCENT)}>
                {line}
              </p>
            ))}
            {company?.phone && (
              <p className={cn("text-[9.5px]", ACCENT)}>{company.phone}</p>
            )}
            {company?.email && (
              <p className="text-[9.5px] text-[#2257c5]">{company.email}</p>
            )}
            {company?.gstin && (
              <p className="text-[9.5px]">GSTIN: {company.gstin}</p>
            )}
          </div>
        </header>

        {/* Quote details and place of supply */}
        <div className="grid grid-cols-2 border-b border-[#6b6b6b]">
          <dl className="grid grid-cols-[6.5rem_1fr] content-start gap-y-0.5 border-r border-[#6b6b6b] px-1.5 py-1.5">
            {details
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className={LABEL}>{label}</dt>
                  <dd className="font-bold">: {value}</dd>
                </div>
              ))}
          </dl>
          <dl className="grid grid-cols-[6.5rem_1fr] content-start px-1.5 py-1.5">
            <dt className={LABEL}>Place Of Supply</dt>
            <dd className="font-bold">
              : {placeOfSupplyLabel(quote.place_of_supply) ?? "—"}
            </dd>
          </dl>
        </div>

        {/* The customer */}
        <div className="border-b border-[#6b6b6b] bg-[#f1f1f1] px-1.5 py-0.5 font-bold">
          Bill To
        </div>
        <div className="border-b border-[#6b6b6b] px-1.5 py-1.5">
          <p className={cn("font-bold", CUSTOMER)}>
            {customer?.display_name ?? quote.customer_name}
          </p>
          {billingLines.map((line, index) => (
            <p key={index} className="text-[9.5px] uppercase">
              {line}
            </p>
          ))}
          {customer?.gstin && (
            <p className="text-[9.5px]">GSTIN: {customer.gstin}</p>
          )}
        </div>

        {quote.subject && (
          <div className="border-b border-[#6b6b6b] px-1.5 py-1.5">
            <p className={LABEL}>Subject :</p>
            <p>{quote.subject}</p>
          </div>
        )}

        {/* The items */}
        <table className="w-full border-collapse text-[9.5px]">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className={cn(head, "w-6 border-r border-b text-center")}
              >
                #
              </th>
              <th
                rowSpan={2}
                className={cn(head, "border-r border-b text-left")}
              >
                Item &amp; Description
              </th>
              <th
                rowSpan={2}
                className={cn(head, "w-12 border-r border-b text-right")}
              >
                Qty
              </th>
              <th
                rowSpan={2}
                className={cn(head, "w-16 border-r border-b text-right")}
              >
                Rate
              </th>
              {showDiscount && (
                <th
                  rowSpan={2}
                  className={cn(head, "w-14 border-r border-b text-right")}
                >
                  Discount
                </th>
              )}
              {taxGroups.map((name) => (
                <th
                  key={name}
                  colSpan={2}
                  className={cn(head, "border-r border-b text-center")}
                >
                  {name}
                </th>
              ))}
              <th
                rowSpan={2}
                className={cn(head, "w-[4.5rem] border-b text-right")}
              >
                Amount
              </th>
            </tr>
            <tr>
              {taxGroups.map((name) => (
                <TaxHead key={name} className={head} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({ line, tax, cgstAmount, sgstAmount, igstAmount }, index) => (
                <tr key={line.id} className="break-inside-avoid">
                  <td
                    className={cn(
                      cell,
                      "border-r border-b text-center",
                      ITEM_ACCENT,
                    )}
                  >
                    {index + 1}
                  </td>
                  <td className={cn(cell, "border-r border-b")}>
                    <div className="flex gap-3">
                      {line.imageUrl && (
                        <img
                          src={line.imageUrl}
                          alt=""
                          className="h-11 w-11 shrink-0 object-contain"
                        />
                      )}
                      <div className="min-w-0">
                        <p>{line.name}</p>
                        {line.description && (
                          <p className="whitespace-pre-line text-[#555]">
                            {line.description}
                          </p>
                        )}
                        {line.hsn_code && (
                          <p className="mt-2">HSN: {line.hsn_code}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td
                    className={cn(
                      cell,
                      "border-r border-b text-right",
                      ITEM_ACCENT,
                    )}
                  >
                    {quantityFormat.format(line.quantity)}
                    {line.unit && (
                      <span className="block text-[8.5px] text-[#555]">
                        {line.unit}
                      </span>
                    )}
                  </td>
                  <td className={cn(cell, "border-r border-b text-right")}>
                    {amount(line.rate)}
                  </td>
                  {showDiscount && (
                    <td
                      className={cn(
                        cell,
                        "border-r border-b text-right",
                        ITEM_ACCENT,
                      )}
                    >
                      {line.discount_value > 0
                        ? line.discount_is_percent
                          ? `${Number(line.discount_value.toFixed(2))}%`
                          : amount(line.discount_value)
                        : ""}
                    </td>
                  )}
                  {showIntra && (
                    <>
                      <TaxCells
                        rate={tax.cgst}
                        value={cgstAmount}
                        className={cell}
                      />
                      <TaxCells
                        rate={tax.sgst}
                        value={sgstAmount}
                        className={cell}
                      />
                    </>
                  )}
                  {showInter && (
                    <TaxCells
                      rate={tax.igst}
                      value={igstAmount}
                      className={cell}
                    />
                  )}
                  <td className={cn(cell, "border-b text-right")}>
                    {amount(line.amount)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        {/* Words, bank details and terms; totals and signature */}
        <div className="grid grid-cols-[1fr_15rem] break-inside-avoid">
          <div className="flex flex-col gap-3 border-r border-[#6b6b6b] px-1.5 py-2">
            <div>
              <p className={LABEL}>Total In Words</p>
              <p className="font-bold italic">{amountInWords(quote.total)}</p>
            </div>
            {quote.notes && (
              <div>
                <p className={LABEL}>Notes</p>
                <p className="whitespace-pre-line">{quote.notes}</p>
              </div>
            )}
            {company?.bank_details && (
              <div>
                <p className={cn("font-bold", LABEL)}>BANK DETAILS</p>
                {lines(company.bank_details).map((line, index) => {
                  // "Bank Name : STATE BANK OF INDIA": the value in the accent colour.
                  const split = line.indexOf(":");
                  return split > 0 ? (
                    <p key={index}>
                      {line.slice(0, split + 1)}
                      <span className={ACCENT}>{line.slice(split + 1)}</span>
                    </p>
                  ) : (
                    <p key={index}>{line}</p>
                  );
                })}
              </div>
            )}
            {quote.terms && (
              <div>
                <p className={ACCENT}>Terms &amp; Conditions</p>
                <p className="whitespace-pre-line">{quote.terms}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-[#6b6b6b] px-1.5 py-2 text-right">
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
              {/* TDS / TCS is hidden for now; uncomment to print it again.
              {quote.direct_tax_amount > 0 && (
                <>
                  <dt>
                    {quote.tax_deduction_type}
                    {quote.direct_tax_name &&
                      ` (${quote.direct_tax_name}${quote.direct_tax_rate !== null ? ` ${Number(quote.direct_tax_rate.toFixed(2))}%` : ""})`}
                  </dt>
                  <dd>
                    {quote.tax_deduction_type === "TDS" ? "(−) " : ""}
                    {amount(quote.direct_tax_amount)}
                  </dd>
                </>
              )}
              */}
              {quote.adjustment !== 0 && (
                <>
                  <dt>{quote.adjustment_description || "Adjustment"}</dt>
                  <dd>{amount(quote.adjustment)}</dd>
                </>
              )}
              <dt className="font-bold">Total</dt>
              <dd className="font-bold">{formatCurrency(quote.total)}</dd>
            </dl>
            <div className="flex min-h-36 flex-1 flex-col items-center justify-end gap-1 px-1.5 pt-2 pb-1.5">
              {data.signatureUrl && (
                <img
                  src={data.signatureUrl}
                  alt="Signature"
                  className="max-h-28 max-w-full object-contain"
                />
              )}
              <p>Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TaxHead({ className }: { className: string }) {
  return (
    <>
      <th className={cn(className, "w-7 border-r border-b text-center")}>%</th>
      <th className={cn(className, "w-12 border-r border-b text-right")}>
        Amt
      </th>
    </>
  );
}

function TaxCells({
  rate,
  value,
  className,
}: {
  rate: number;
  value: number;
  className: string;
}) {
  return (
    <>
      <td
        className={cn(className, "border-r border-b text-center", ITEM_ACCENT)}
      >
        {rate ? `${percent(rate)} %` : ""}
      </td>
      <td className={cn(className, "border-r border-b text-right")}>
        {rate ? amount(value) : ""}
      </td>
    </>
  );
}
