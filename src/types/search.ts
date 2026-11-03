import type { AppModule } from "@/constants/permissions"

// Modules the header search can look inside. Reports has no records of its own.
export type SearchScope = "users" | Exclude<AppModule, "reports">

// One suggestion in the header search dropdown.
export type SearchResult = {
  id: string
  href: string
  title: string
  // Shown under the title, separated by bars: "SKU: HE1I1CR | Rate: ₹32,000".
  details: { label?: string; value: string }[]
  // Shown on the right, e.g. a status.
  badge?: { label: string; tone?: "default" | "success" | "destructive" }
}
