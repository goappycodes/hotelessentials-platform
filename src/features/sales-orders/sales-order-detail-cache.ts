"use client"

import { getSalesOrderDetail } from "@/actions/sales-orders"
import type { SalesOrderDocumentData } from "@/features/sales-orders/queries"

// Recently loaded sales orders, so hovering a row starts loading before the click and
// reopening one is instant. Anything that changes an order calls invalidateSalesOrderDetail
// so the panel never shows old values.
const CACHE_MS = 30_000
const detailCache = new Map<
  string,
  { at: number; request: Promise<SalesOrderDocumentData | null> }
>()

export function loadSalesOrderDetail(salesOrderId: string) {
  const cached = detailCache.get(salesOrderId)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.request
  const request = getSalesOrderDetail(salesOrderId)
  // A failed request is not kept, so the next attempt tries again.
  request.catch(() => detailCache.delete(salesOrderId))
  detailCache.set(salesOrderId, { at: Date.now(), request })
  return request
}

export function prefetchSalesOrderDetail(salesOrderId: string) {
  void loadSalesOrderDetail(salesOrderId).catch(() => undefined)
}

export function invalidateSalesOrderDetail(salesOrderId: string) {
  detailCache.delete(salesOrderId)
}
