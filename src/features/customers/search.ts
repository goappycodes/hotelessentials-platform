import "server-only"

import { customerRoute } from "@/constants/routes"
import { CUSTOMERS_LIST } from "@/features/customers/list-config"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { createClient } from "@/lib/supabase/server"
import type { SearchResult } from "@/types/search"

// Header search suggestions for Customers. Matches the same columns as the list.
export async function searchCustomers(term: string, limit: number): Promise<SearchResult[]> {
  const query = parseListQuery({ q: term }, CUSTOMERS_LIST)
  if (!query.search) return []

  const supabase = await createClient()
  const { data, error } = await applyListFilters(
    supabase
      .from("customers")
      .select("id, display_name, company_name, email, mobile, work_phone, is_active"),
    query
  )
    .order("display_name")
    .limit(limit)
  if (error) throw new Error("Failed to search customers")

  return data.map((customer) => ({
    id: customer.id,
    href: customerRoute(customer.id),
    title: customer.display_name,
    details: [
      ...(customer.company_name && customer.company_name !== customer.display_name
        ? [{ value: customer.company_name }]
        : []),
      ...(customer.email ? [{ value: customer.email }] : []),
      ...(customer.mobile || customer.work_phone
        ? [{ value: (customer.mobile || customer.work_phone) as string }]
        : []),
    ],
    badge: customer.is_active ? undefined : { label: "Inactive", tone: "destructive" },
  }))
}
