"use client"

import { getDespatchDetail } from "@/actions/despatch"
import type { DespatchDocumentData } from "@/features/despatch/queries"

// Recently loaded despatches, so hovering a row starts loading before the click and
// reopening one is instant. Anything that changes a despatch calls invalidateDespatchDetail
// so the panel never shows old values.
const CACHE_MS = 30_000
const detailCache = new Map<
  string,
  { at: number; request: Promise<DespatchDocumentData | null> }
>()

export function loadDespatchDetail(despatchId: string) {
  const cached = detailCache.get(despatchId)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.request
  const request = getDespatchDetail(despatchId)
  // A failed request is not kept, so the next attempt tries again.
  request.catch(() => detailCache.delete(despatchId))
  detailCache.set(despatchId, { at: Date.now(), request })
  return request
}

export function prefetchDespatchDetail(despatchId: string) {
  void loadDespatchDetail(despatchId).catch(() => undefined)
}

export function invalidateDespatchDetail(despatchId: string) {
  detailCache.delete(despatchId)
}
