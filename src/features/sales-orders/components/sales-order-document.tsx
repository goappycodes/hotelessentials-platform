import { QuotationDocument } from "@/features/quotations/components/quotation-document"
import type { SalesOrderDocumentData } from "@/features/sales-orders/queries"

// A sales order in the quotation's layout, with its own heading and number. No hooks, so
// it renders on the server or the client.
export function SalesOrderDocument({
  data,
  showStatus,
  className,
}: {
  data: SalesOrderDocumentData
  showStatus?: boolean
  className?: string
}) {
  const { order } = data
  return (
    <QuotationDocument
      data={{
        ...data,
        quote: { ...order, quote_date: order.order_date, quote_number: order.so_number },
      }}
      title="Sales Order"
      // Hidden for now; uncomment to show the quotation number under the order number.
      // details={[{ label: "Quotation No", value: order.quote_number }]}
      showStatus={showStatus}
      className={className}
    />
  )
}
