import { Badge } from "@/components/ui/badge"
import type { Enums } from "@/types/database"

export function DespatchStatusBadge({ status }: { status: Enums<"despatch_status"> }) {
  switch (status) {
    case "Despatched":
      return <Badge className="bg-sky-500/10 text-sky-700">Despatched</Badge>
    case "Delivered":
      return <Badge className="bg-emerald-500/10 text-emerald-700">Delivered</Badge>
    default:
      return <Badge variant="secondary">Packed</Badge>
  }
}
