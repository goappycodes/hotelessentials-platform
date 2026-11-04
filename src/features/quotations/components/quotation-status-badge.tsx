import { Badge } from "@/components/ui/badge"
import type { Enums } from "@/types/database"

// A quotation's status; Draft or Sent quotes past their expiry date show as Expired.
export function QuotationStatusBadge({
  status,
  isExpired,
}: {
  status: Enums<"quotation_status">
  isExpired: boolean
}) {
  if (isExpired) return <Badge className="bg-amber-500/10 text-amber-700">Expired</Badge>
  switch (status) {
    case "Sent":
      return <Badge className="bg-sky-500/10 text-sky-700">Sent</Badge>
    case "Accepted":
      return <Badge className="bg-emerald-500/10 text-emerald-700">Accepted</Badge>
    case "Declined":
      return <Badge variant="destructive">Declined</Badge>
    default:
      return <Badge variant="secondary">Draft</Badge>
  }
}

export function isQuotationExpired(
  quote: { status: Enums<"quotation_status">; expiry_date: string | null },
  today: string
) {
  return (
    (quote.status === "Draft" || quote.status === "Sent") &&
    quote.expiry_date !== null &&
    quote.expiry_date < today
  )
}
