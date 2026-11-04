"use client"

import { getItemDetail, type ItemDetailData } from "@/actions/items"

// Recently loaded item details, so hovering a row can start loading before the click and
// reopening an item is instant. Entries expire quickly, and anything that changes an item
// must call invalidateItemDetail so the panel never shows old values.
const CACHE_MS = 30_000
const detailCache = new Map<string, { at: number; request: Promise<ItemDetailData | null> }>()

export function loadItemDetail(itemId: string) {
  const cached = detailCache.get(itemId)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.request
  const request = getItemDetail(itemId)
  // A failed request is not kept, so the next attempt tries again.
  request.catch(() => detailCache.delete(itemId))
  detailCache.set(itemId, { at: Date.now(), request })
  return request
}

export function prefetchItemDetail(itemId: string) {
  void loadItemDetail(itemId).catch(() => undefined)
}

export function invalidateItemDetail(itemId: string) {
  detailCache.delete(itemId)
}
