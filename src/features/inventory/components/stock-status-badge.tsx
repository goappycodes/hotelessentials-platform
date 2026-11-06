import { Badge } from "@/components/ui/badge"
import type { StockStatus } from "@/constants/inventory"

export function StockStatusBadge({ status }: { status: StockStatus }) {
  switch (status) {
    case "In Stock":
      return <Badge className="bg-emerald-500/10 text-emerald-700">In Stock</Badge>
    case "Low Stock":
      return <Badge className="bg-amber-500/10 text-amber-700">Low Stock</Badge>
    default:
      return <Badge variant="destructive">Out of Stock</Badge>
  }
}
