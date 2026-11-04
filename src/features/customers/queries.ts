import "server-only"

import type { createRequestClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createRequestClient>>

// Choices for the customer form: sales price lists and the people who can own a customer.
export async function getCustomerFormOptions(supabase: Client) {
  const [priceLists, owners] = await Promise.all([
    supabase
      .from("price_lists")
      .select("id, name, is_active")
      .eq("transaction_type", "Sales")
      .order("name"),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, is_active")
      .order("first_name"),
  ])
  // Price lists the user can't view are simply not offered.
  if (owners.error) throw new Error("Failed to load the form")

  return {
    priceLists: priceLists.data ?? [],
    owners: owners.data.map((owner) => ({
      id: owner.id,
      name: [owner.first_name, owner.last_name].filter(Boolean).join(" "),
      isActive: owner.is_active,
    })),
  }
}

export type CustomerFormOptions = Awaited<ReturnType<typeof getCustomerFormOptions>>
