import { Badge } from "@/components/ui/badge"
import type { Enums } from "@/types/database"

export function SalesOrderStatusBadge({ status }: { status: Enums<"sales_order_status"> }) {
  switch (status) {
    case "Confirmed":
      return <Badge className="bg-sky-500/10 text-sky-700">Confirmed</Badge>
    case "Closed":
      return <Badge className="bg-emerald-500/10 text-emerald-700">Closed</Badge>
    default:
      return <Badge variant="secondary">Draft</Badge>
  }
}
