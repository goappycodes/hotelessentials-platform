"use server"

import { z } from "zod"

import { PRICE_LISTS_LIST } from "@/features/price-lists/list-config"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import { priceListSchema, type PriceListInput } from "@/lib/validations/price-list"
import type { ActionResult } from "@/types/actions"

const NOT_ALLOWED = "You don't have permission to do that."

// Creates a price list (priceListId null) or updates one, with its item rates, in one
// database transaction (public.save_price_list).
export async function savePriceList(
  priceListId: string | null,
  input: PriceListInput
): Promise<ActionResult<{ id: string }>> {
  const id = priceListId === null ? null : z.uuid().safeParse(priceListId)
  const parsed = priceListSchema.safeParse(input)
  if (!parsed.success || (id && !id.success)) {
    return { success: false, error: "Please check the form and try again." }
  }

  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "price_lists", id ? "edit" : "create")) {
    return { success: false, error: NOT_ALLOWED }
  }

  const list = parsed.data
  const isAllItems = list.priceListType === "All Items"
  const usesDecimalPlaces = list.roundOffTo === "Decimal Places"

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("save_price_list", {
    target_id: id ? id.data : null,
    name: list.name,
    transaction_type: list.transactionType,
    price_list_type: list.priceListType,
    description: list.description,
    percentage_type: isAllItems ? list.percentageType : null,
    percentage_value: isAllItems ? Number(list.percentageValue) : null,
    round_off_to: isAllItems ? list.roundOffTo : "Never mind",
    decimal_places: isAllItems && usesDecimalPlaces ? Number(list.decimalPlaces) : null,
    is_active: list.isActive,
    item_rates: isAllItems
      ? []
      : Object.entries(list.itemRates)
          .filter(([, rate]) => rate !== "")
          .map(([itemId, rate]) => ({ item_id: itemId, rate: Number(rate) })),
  })

  if (error?.code === "23505") {
    return { success: false, error: "A price list with this name already exists." }
  }
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  return { success: true, data: { id: data } }
}

const countFiltersSchema = z.record(z.string(), z.string())

// "Total Count: View" on the price lists list. Same filters and search as the list.
export async function countPriceLists(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  const session = await fetchSession()
  if (!parsed.success || !session?.user.isActive || !hasAccess(session, "price_lists")) {
    throw new Error(NOT_ALLOWED)
  }

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("price_lists").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, PRICE_LISTS_LIST)
  )
  if (error) throw new Error("Failed to count price lists")
  return count ?? 0
}
