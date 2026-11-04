import { toMoneyInput } from "@/lib/format"
import type { ItemInput } from "@/lib/validations/item"
import type { Tables } from "@/types/database"

// Form values for an existing item (edit), or a copy of it (clone).
export function toItemInput(item: Tables<"items">): ItemInput {
  return {
    type: item.type,
    name: item.name,
    sku: item.sku ?? "",
    unit: item.unit ?? "",
    hsnCodeId: item.hsn_code_id ?? "",
    taxPreference: item.tax_preference,
    salesEnabled: item.sales_enabled,
    sellingPrice: toMoneyInput(item.selling_price),
    salesAccount: item.sales_account as ItemInput["salesAccount"],
    salesDescription: item.sales_description ?? "",
    purchaseEnabled: item.purchase_enabled,
    costPrice: toMoneyInput(item.cost_price),
    purchaseAccount: item.purchase_account as ItemInput["purchaseAccount"],
    purchaseDescription: item.purchase_description ?? "",
    preferredVendor: item.preferred_vendor ?? "",
    intraStateTaxId: item.intra_state_tax_id ?? "",
    interStateTaxId: item.inter_state_tax_id ?? "",
    trackInventory: item.track_inventory,
    inventoryAccount: item.inventory_account as ItemInput["inventoryAccount"],
    inventoryValuationMethod: item.inventory_valuation_method,
    isActive: item.is_active,
  }
}

// A clone keeps everything except the SKU (a copy is usually a different product, with
// its own code) and starts active. Stock is
// never copied: it comes from inventory adjustments.
export function toClonedItemInput(item: Tables<"items">): ItemInput {
  return { ...toItemInput(item), sku: "", isActive: true }
}
