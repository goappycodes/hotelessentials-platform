import { ListPaginationSkeleton } from "@/components/shared/list-pagination"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ItemRow } from "@/features/items/components/items-workspace"
import { ITEMS_LIST } from "@/features/items/list-config"
import { getSignedImageUrls } from "@/features/items/queries"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { createRequestClient } from "@/lib/supabase/server"

// "Type" goes after "SKU" and "Stock on Hand" after "HSN" when they are switched on again.
const COLUMNS = ["Name", "SKU", "HSN", "Rate", "Purchase Rate", "Status"]

// One page of the items list (sort, filters, search and page from the URL).
export async function getItemRows(searchParams: ListSearchParams) {
  const supabase = await createRequestClient()
  const query = parseListQuery(searchParams, ITEMS_LIST)

  // One request: each item comes with the path of its first image, for the thumbnail.
  // stock_on_hand is left out while inventory is switched off (it's worked out per row);
  // add it back to the select when the Stock on Hand column returns.
  const { data, error } = await applyListQuery(
    supabase
      .from("item_list")
      .select(
        "id, name, sku, type, unit, selling_price, cost_price, sales_enabled, purchase_enabled, is_active, hsn_code, images:item_images(storage_path)"
      )
      .order("sort_order", { referencedTable: "item_images" })
      .limit(1, { referencedTable: "item_images" }),
    query
  )
  if (error) throw new Error("Failed to load items")

  const { rows, hasNextPage } = toListPage(data, query)
  const thumbnails = await getSignedImageUrls(
    supabase,
    rows.flatMap((item) => item.images.map((image) => image.storage_path))
  )

  return {
    hasNextPage,
    isFiltered: Object.keys(query.filters).length > 0 || query.search !== null,
    rows: rows.map(
      (item): ItemRow => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        type: item.type,
        hsnCode: item.hsn_code,
        unit: item.unit,
        // Not loaded while inventory is switched off (see the select above).
        stockOnHand: null,
        sellingPrice: item.selling_price,
        costPrice: item.cost_price,
        salesEnabled: item.sales_enabled,
        purchaseEnabled: item.purchase_enabled,
        isActive: item.is_active,
        thumbnail: (item.images[0] && thumbnails.get(item.images[0].storage_path)) ?? null,
      })
    ),
  }
}

export function ItemsTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          {COLUMNS.map((column) => (
            <Skeleton key={column} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b px-4 py-3">
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="size-9 rounded-md" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
      <ListPaginationSkeleton />
    </div>
  )
}
