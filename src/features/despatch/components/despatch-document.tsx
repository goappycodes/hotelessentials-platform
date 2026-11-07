// The despatch note that travels with the goods: the company's letterhead, where they are
// going, how they travel and the quantities, without prices. Laid out in points like the
// quotation, so print matches. No hooks, so it renders on the server or the client.
/* eslint-disable @next/next/no-img-element -- signed storage URLs, printed as they are */
import type { DespatchDocumentData } from "@/features/despatch/queries"
import {
  DocumentHeading,
  documentAddressLines,
  nameWithoutCode,
} from "@/features/quotations/components/quotation-document"
import { cn } from "@/lib/utils"

const quantityFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 })

const RIBBON_CLASS: Record<string, string> = {
  Packed: "bg-[#7d8b8c]",
  Despatched: "bg-[#4a8bd6]",
  Delivered: "bg-[#3aa76d]",
}

// Column widths in points, in order; they add up to the page's 543.28pt.
const COLUMNS = [
  { label: "S.No.", width: "32.5pt" },
  { label: "Box No", width: "50pt" },
  { label: "Image", width: "76pt" },
  { label: "Code", width: "90pt" },
  { label: "Name", width: "204.78pt" },
  { label: "Qty", width: "90pt" },
]

const HEAD_CELL =
  "h-[22.8pt] border border-black bg-[#1877f2] p-0 text-center align-middle text-[7pt] font-normal text-white"
const CELL = "h-[67pt] border border-black p-0 text-center align-middle"

export function DespatchDocument({
  data,
  showStatus = true,
  className,
}: {
  data: DespatchDocumentData
  // The status ribbon in the corner; off for the copy that goes with the goods.
  showStatus?: boolean
  className?: string
}) {
  const { despatch, customer, company } = data
  const shippingLines = customer
    ? documentAddressLines([
        customer.shipping_attention,
        customer.shipping_street1,
        customer.shipping_street2,
        [customer.shipping_city, customer.shipping_pin_code].filter(Boolean).join(" "),
        customer.shipping_state,
        customer.shipping_phone && `Phone : ${customer.shipping_phone}`,
      ])
    : []
  const billingLines = customer
    ? documentAddressLines([
        customer.billing_attention,
        customer.billing_street1,
        customer.billing_street2,
        [customer.billing_city, customer.billing_pin_code].filter(Boolean).join(" "),
        customer.billing_state,
      ])
    : []
  const transport = [
    ["Transporter", despatch.transporter],
    ["LR / Tracking No", despatch.tracking_number],
    ["Vehicle No", despatch.vehicle_number],
  ].filter((row): row is [string, string] => Boolean(row[1]))
  const boxes = new Set(data.lines.flatMap((line) => (line.box_number ? [line.box_number] : [])))

  return (
    <article
      aria-label={`Despatch Note ${despatch.despatch_number}`}
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
            RIBBON_CLASS[despatch.status]
          )}
        >
          {despatch.status}
        </div>
      )}

      <DocumentHeading
        company={company}
        logoUrl={data.logoUrl}
        customerName={customer?.display_name ?? despatch.customer_name}
        customerGstin={customer?.gstin}
        // Goods go to the shipping address; customers without one get them at the billing one.
        addressLines={shippingLines.length > 0 ? shippingLines : billingLines}
        title="Despatch Note"
        date={despatch.despatch_date}
        number={despatch.despatch_number}
        details={[
          { label: "Sales Order No", value: despatch.so_number },
          ...(boxes.size > 0 ? [{ label: "Total Boxes", value: String(boxes.size) }] : []),
        ]}
      />

      {transport.length > 0 && (
        <dl className="mb-[10pt] flex flex-wrap gap-x-[24pt] gap-y-[2pt] text-[8.5pt] leading-[11pt]">
          {transport.map(([label, value]) => (
            <div key={label}>
              <dt className="inline font-bold">{label}: </dt>
              <dd className="inline">{value}</dd>
            </div>
          ))}
        </dl>
      )}

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
                <td className={cn(CELL, "px-[2pt] font-bold break-words")}>{line.box_number}</td>
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
                <td className={CELL}>
                  {quantityFormat.format(line.quantity)}
                  {line.unit && ` ${line.unit}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {despatch.notes && (
        <section className="mt-[12pt] text-[8.5pt] leading-[11pt] break-inside-avoid">
          <h3 className="mb-[2pt] text-[11pt] leading-[13pt] font-bold">Notes:</h3>
          <p className="whitespace-pre-line">{despatch.notes}</p>
        </section>
      )}

      <div className="mt-[40pt] grid grid-cols-2 gap-[40pt] text-[8.5pt] break-inside-avoid">
        <div className="flex h-[60pt] flex-col justify-end">
          <p className="border-t border-black pt-[3pt] text-center">Received By</p>
        </div>
        <div className="flex h-[60pt] flex-col justify-end">
          {data.signatureUrl && (
            <img
              src={data.signatureUrl}
              alt=""
              className="mx-auto mb-[2pt] max-h-[44pt] object-contain"
            />
          )}
          <p className="border-t border-black pt-[3pt] text-center">Authorized Signature</p>
        </div>
      </div>
    </article>
  )
}
