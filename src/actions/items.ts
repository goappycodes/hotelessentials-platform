"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

import {
  ITEM_IMAGE_TYPES,
  ITEM_IMAGES_BUCKET,
  MAX_ITEM_IMAGE_BYTES,
  MAX_ITEM_IMAGES,
} from "@/constants/items"
import { PAGE_SIZE_OPTIONS } from "@/constants/list"
import type { PermissionAction } from "@/constants/permissions"
import { ITEMS_LIST } from "@/features/items/list-config"
import { getItemImages, type ItemImageView } from "@/features/items/queries"
import { TAX_RATE_COLUMNS, type TaxRate } from "@/features/taxes/tax-rates"
import { applyListFilters, parseListQuery } from "@/lib/list-query"
import { hasAccess, isAdminRole } from "@/lib/permissions"
import { fetchSession } from "@/lib/session"
import { getDatabaseErrorMessage } from "@/lib/supabase/database-errors"
import { createClient } from "@/lib/supabase/server"
import {
  hsnCodeSchema,
  itemSchema,
  type HsnCodeInput,
  type ItemInput,
} from "@/lib/validations/item"
import type { ActionResult } from "@/types/actions"
import type { Tables } from "@/types/database"

const INVALID_INPUT = "Please check the form and try again."
const MAX_PAGE_SIZE = Math.max(...PAGE_SIZE_OPTIONS)
const NOT_ALLOWED = "You don't have permission to do that."

async function authorize(...actions: PermissionAction[]) {
  const session = await fetchSession()
  if (!session?.user.isActive) return null
  return actions.some((action) => hasAccess(session, "items", action)) ? session : null
}

function toItemRow(item: ItemInput) {
  return {
    name: item.name,
    type: item.type,
    sku: item.sku || null,
    unit: item.unit || null,
    hsn_code_id: item.hsnCodeId || null,
    tax_preference: item.taxPreference,
    sales_enabled: item.salesEnabled,
    selling_price: Number(item.sellingPrice || 0),
    sales_account: item.salesAccount,
    sales_description: item.salesDescription || null,
    purchase_enabled: item.purchaseEnabled,
    cost_price: Number(item.costPrice || 0),
    purchase_account: item.purchaseAccount,
    purchase_description: item.purchaseDescription || null,
    preferred_vendor: item.preferredVendor || null,
    // Taxes only apply to taxable items.
    intra_state_tax_id: item.taxPreference === "Taxable" ? item.intraStateTaxId || null : null,
    inter_state_tax_id: item.taxPreference === "Taxable" ? item.interStateTaxId || null : null,
    // Inventory settings are kept when tracking is off, so turning it back on restores them.
    track_inventory: item.type === "Goods" && item.trackInventory,
    inventory_account: item.inventoryAccount,
    inventory_valuation_method: item.inventoryValuationMethod,
    is_active: item.isActive,
  }
}

function getItemErrorMessage(error: PostgrestError) {
  if (error.message.includes("valid_taxes_for_taxable")) return "Taxable items need both taxes."
  if (error.message.includes("valid_inventory_for_goods")) return "Only goods can track inventory."
  // Raised by the tax scope and inventory checks on items; the messages are written for users.
  if (error.code === "23514" && /^(The |This item )/.test(error.message)) return error.message
  return getDatabaseErrorMessage(error)
}

// Creates an item (itemId null) or updates one. Returns its id so images can follow.
export async function saveItem(
  itemId: string | null,
  input: ItemInput
): Promise<ActionResult<{ id: string }>> {
  const id = itemId === null ? null : z.uuid().safeParse(itemId)
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success || (id && !id.success)) return { success: false, error: INVALID_INPUT }

  if (!(await authorize(id ? "edit" : "create"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const row = toItemRow(parsed.data)
  const { data, error } = id
    ? await supabase.from("items").update(row).eq("id", id.data).select("id").maybeSingle()
    : await supabase.from("items").insert(row).select("id").single()

  if (error) return { success: false, error: getItemErrorMessage(error) }
  if (!data) return { success: false, error: "This item no longer exists." }
  return { success: true, data: { id: data.id } }
}

export async function createHsnCode(
  input: HsnCodeInput
): Promise<ActionResult<{ id: string; code: string; description: string | null }>> {
  const parsed = hsnCodeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("create", "edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("hsn_codes")
    .insert(parsed.data)
    .select("id, code, description")
    .single()

  if (error?.code === "23505") return { success: false, error: "This HSN code already exists." }
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  return { success: true, data }
}

const countFiltersSchema = z.record(z.string(), z.string())

// "Total Count: View" on the items list. Counts with the same filters and search as the list.
export async function countItems(filters: Record<string, string>) {
  const parsed = countFiltersSchema.safeParse(filters)
  if (!parsed.success || !(await authorize("view"))) throw new Error(NOT_ALLOWED)

  const supabase = await createClient()
  const { count, error } = await applyListFilters(
    supabase.from("item_list").select("id", { count: "exact", head: true }),
    parseListQuery(parsed.data, ITEMS_LIST)
  )
  if (error) throw new Error("Failed to count items")
  return count ?? 0
}

const uploadedImagesSchema = z
  .array(
    z.object({
      storagePath: z.string().min(1).max(300),
      fileName: z.string().trim().min(1).max(200),
      contentType: z.string().refine((type) => ITEM_IMAGE_TYPES.includes(type)),
      fileSize: z.number().int().positive().max(MAX_ITEM_IMAGE_BYTES),
    })
  )
  .min(1)
  .max(MAX_ITEM_IMAGES)

// Records images the browser has already uploaded to storage under `<itemId>/`.
export async function addItemImages(
  itemId: string,
  images: z.infer<typeof uploadedImagesSchema>
): Promise<ActionResult> {
  const id = z.uuid().safeParse(itemId)
  const parsed = uploadedImagesSchema.safeParse(images)
  if (!id.success || !parsed.success) return { success: false, error: INVALID_INPUT }
  if (parsed.data.some((image) => !image.storagePath.startsWith(`${id.data}/`))) {
    return { success: false, error: INVALID_INPUT }
  }
  if (!(await authorize("create", "edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { count } = await supabase
    .from("item_images")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id.data)
  const existing = count ?? 0
  if (existing + parsed.data.length > MAX_ITEM_IMAGES) {
    return { success: false, error: `An item can have at most ${MAX_ITEM_IMAGES} images.` }
  }

  const { error } = await supabase.from("item_images").insert(
    parsed.data.map((image, index) => ({
      item_id: id.data,
      storage_path: image.storagePath,
      file_name: image.fileName,
      content_type: image.contentType,
      file_size: image.fileSize,
      sort_order: existing + index,
    }))
  )
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  return { success: true, data: undefined }
}

export async function removeItemImage(imageId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(imageId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("item_images")
    .delete()
    .eq("id", id.data)
    .select("storage_path")
    .maybeSingle()
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  if (data) await supabase.storage.from(ITEM_IMAGES_BUCKET).remove([data.storage_path])
  return { success: true, data: undefined }
}

const itemIdSchema = z.uuid()

export async function setItemActive(itemId: string, isActive: boolean): Promise<ActionResult> {
  const id = itemIdSchema.safeParse(itemId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("items")
    .update({ is_active: isActive === true })
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  if (!data) return { success: false, error: "This item no longer exists." }
  return { success: true, data: undefined }
}

// Owners and admins only; the database enforces it as well.
export async function setItemLocked(itemId: string, isLocked: boolean): Promise<ActionResult> {
  const id = itemIdSchema.safeParse(itemId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  const session = await fetchSession()
  if (!session?.user.isActive || !isAdminRole(session.role)) {
    return { success: false, error: "Only owners and admins can lock or unlock items." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("items")
    .update({ is_locked: isLocked === true })
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  if (!data) return { success: false, error: "This item no longer exists." }
  return { success: true, data: undefined }
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  const id = itemIdSchema.safeParse(itemId)
  if (!id.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("delete"))) return { success: false, error: NOT_ALLOWED }

  return removeItem(await createClient(), id.data)
}

// Deletes one item and its images; the caller has already authorized the user.
async function removeItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string
): Promise<ActionResult> {
  const { data: images } = await supabase
    .from("item_images")
    .select("storage_path")
    .eq("item_id", itemId)

  const { data, error } = await supabase
    .from("items")
    .delete()
    .eq("id", itemId)
    .select("id")
    .maybeSingle()
  if (error?.code === "23503") {
    return {
      success: false,
      error: error.message.includes("inventory_adjustment_items")
        ? "This item is used in an inventory adjustment, so it can't be deleted. Mark it as inactive instead."
        : "This item is used in a price list, so it can't be deleted. Mark it as inactive instead.",
    }
  }
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }
  if (!data) return { success: false, error: "This item no longer exists." }

  if (images?.length) {
    await supabase.storage.from(ITEM_IMAGES_BUCKET).remove(images.map((image) => image.storage_path))
  }
  return { success: true, data: undefined }
}

// One adjusted inventory adjustment that changed this item's stock.
// Items picked with the list checkboxes: at most one page.
const itemIdsSchema = z.array(z.uuid()).min(1).max(MAX_PAGE_SIZE)

export type BulkItemsResult = {
  changed: number
  // Items left as they were, e.g. locked ones, with the first reason.
  skipped: number
  skippedReason?: string
}

// Mark as Active / Mark as Inactive for the selected items. Locked items are skipped.
export async function setItemsActive(
  itemIds: string[],
  isActive: boolean
): Promise<ActionResult<BulkItemsResult>> {
  const ids = itemIdsSchema.safeParse(itemIds)
  if (!ids.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("edit"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("items")
    .update({ is_active: isActive === true })
    .in("id", ids.data)
    .eq("is_locked", false)
    .select("id")
  if (error) return { success: false, error: getDatabaseErrorMessage(error) }

  const skipped = ids.data.length - data.length
  return {
    success: true,
    data: {
      changed: data.length,
      skipped,
      skippedReason: skipped ? "Locked items can't be changed." : undefined,
    },
  }
}

// Delete for the selected items, one at a time so an item that can't be deleted (locked,
// or used in a price list) doesn't stop the others.
export async function deleteItems(itemIds: string[]): Promise<ActionResult<BulkItemsResult>> {
  const ids = itemIdsSchema.safeParse(itemIds)
  if (!ids.success) return { success: false, error: INVALID_INPUT }
  if (!(await authorize("delete"))) return { success: false, error: NOT_ALLOWED }

  const supabase = await createClient()
  let changed = 0
  let skippedReason: string | undefined
  for (const id of ids.data) {
    const result = await removeItem(supabase, id)
    if (result.success) changed += 1
    else skippedReason ??= result.error
  }
  return {
    success: true,
    data: { changed, skipped: ids.data.length - changed, skippedReason },
  }
}

export type ItemStockHistoryEntry = {
  adjustmentId: string
  date: string
  reason: string
  referenceNumber: string | null
  quantityAdjusted: number
}

export type ItemDetailData = {
  item: Tables<"items">
  hsnCode: { code: string; description: string | null } | null
  intraTax: TaxRate | null
  interTax: TaxRate | null
  images: ItemImageView[]
  // Null when the item doesn't track inventory.
  stock: { onHand: number; history: ItemStockHistoryEntry[] } | null
  can: {
    create: boolean
    edit: boolean
    delete: boolean
    lock: boolean
    // Inventory adjustments: open them, and create one for this item.
    viewAdjustments: boolean
    adjustStock: boolean
  }
}

// The latest adjustments shown in the panel's History tab.
const STOCK_HISTORY_LIMIT = 50

// Everything the side panel shows for one item. Null when it doesn't exist or the user
// can't view items.
export async function getItemDetail(itemId: string): Promise<ItemDetailData | null> {
  const id = itemIdSchema.safeParse(itemId)
  if (!id.success) return null
  const session = await fetchSession()
  if (!session?.user.isActive || !hasAccess(session, "items")) return null

  const supabase = await createClient()
  const [itemResult, images, stockResult, historyResult] = await Promise.all([
    supabase
      .from("items")
      // Taxes come in the same request as the item.
      .select(
        `*, hsn_code:hsn_codes(code, description), intra_tax:tax_rates!items_intra_state_tax_id_fkey(${TAX_RATE_COLUMNS}), inter_tax:tax_rates!items_inter_state_tax_id_fkey(${TAX_RATE_COLUMNS})`
      )
      .eq("id", id.data)
      .maybeSingle(),
    getItemImages(supabase, id.data),
    // Stock on hand is worked out by the item_list view, over all of the item's history.
    supabase.from("item_list").select("stock_on_hand").eq("id", id.data).maybeSingle(),
    // Adjusted adjustments that include this item (drafts don't change stock).
    supabase
      .from("inventory_adjustments")
      .select(
        "id, adjustment_date, reason, reference_number, lines:inventory_adjustment_items!inner(quantity_adjusted)"
      )
      .eq("lines.item_id", id.data)
      .eq("status", "Adjusted")
      .order("adjustment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(STOCK_HISTORY_LIMIT),
  ])
  if (itemResult.error || stockResult.error || historyResult.error) {
    throw new Error("Failed to load the item")
  }
  if (!itemResult.data) return null

  const { hsn_code: hsnCode, intra_tax: intraTax, inter_tax: interTax, ...item } =
    itemResult.data
  const onHand = stockResult.data?.stock_on_hand

  return {
    item,
    hsnCode,
    intraTax,
    interTax,
    images,
    stock:
      item.track_inventory && onHand !== null && onHand !== undefined
        ? {
            onHand,
            history: historyResult.data.map((adjustment) => ({
              adjustmentId: adjustment.id,
              date: adjustment.adjustment_date,
              reason: adjustment.reason,
              referenceNumber: adjustment.reference_number,
              // One line per item in an adjustment.
              quantityAdjusted: adjustment.lines[0]?.quantity_adjusted ?? 0,
            })),
          }
        : null,
    can: {
      create: hasAccess(session, "items", "create"),
      edit: hasAccess(session, "items", "edit"),
      delete: hasAccess(session, "items", "delete"),
      lock: isAdminRole(session.role),
      viewAdjustments: hasAccess(session, "inventory_adjustments"),
      adjustStock: hasAccess(session, "inventory_adjustments", "create"),
    },
  }
}
