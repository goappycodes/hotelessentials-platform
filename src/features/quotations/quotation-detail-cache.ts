"use client"

import { getQuotationDetail } from "@/actions/quotations"
import type { QuotationDocumentData } from "@/features/quotations/queries"

// Recently loaded quotations, so hovering a row starts loading before the click and
// reopening one is instant. Anything that changes a quotation calls
// invalidateQuotationDetail so the panel never shows old values.
const CACHE_MS = 30_000
const detailCache = new Map<
  string,
  { at: number; request: Promise<QuotationDocumentData | null> }
>()

export function loadQuotationDetail(quotationId: string) {
  const cached = detailCache.get(quotationId)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.request
  const request = getQuotationDetail(quotationId)
  // A failed request is not kept, so the next attempt tries again.
  request.catch(() => detailCache.delete(quotationId))
  detailCache.set(quotationId, { at: Date.now(), request })
  return request
}

export function prefetchQuotationDetail(quotationId: string) {
  void loadQuotationDetail(quotationId).catch(() => undefined)
}

export function invalidateQuotationDetail(quotationId: string) {
  detailCache.delete(quotationId)
}
