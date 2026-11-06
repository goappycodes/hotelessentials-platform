import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"

import { AccessDenied } from "@/components/shared/access-denied"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"
import { PrintToolbar } from "@/features/quotations/components/print-toolbar"
import { QuotationDocumentSkeleton } from "@/features/quotations/components/quotation-panel"
import { SalesOrderDocument } from "@/features/sales-orders/components/sales-order-document"
import { getSalesOrderDocument } from "@/features/sales-orders/queries"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.salesOrders

export const metadata: Metadata = { title: "Print sales order" }

// A sales order on its own page, without the app around it, for printing or saving as PDF.
export default function PrintSalesOrderPage({ params }: PageProps<"/print/sales-orders/[id]">) {
  return (
    <main className="min-h-svh bg-muted/40 px-4 pb-8 print:bg-white print:p-0">
      <style>{"@page { size: A4; margin: 13pt 0; }"}</style>
      <Suspense fallback={<PrintSalesOrderSkeleton />}>
        <PrintSalesOrder params={params} />
      </Suspense>
    </main>
  )
}

async function PrintSalesOrder({ params }: Pick<PageProps<"/print/sales-orders/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()])
  if (!hasAccess(session, navItem.access)) return <AccessDenied area={navItem.title} />
  if (!z.uuid().safeParse(id).success) notFound()

  const data = await getSalesOrderDocument(await createRequestClient(), id)
  if (!data) notFound()

  return (
    <>
      <PrintToolbar title={data.order.so_number} />
      <div className="mx-auto max-w-[210mm] border bg-white shadow-sm print:border-0 print:shadow-none">
        <SalesOrderDocument data={data} showStatus={false} className="print:w-full print:py-0" />
      </div>
    </>
  )
}

function PrintSalesOrderSkeleton() {
  return (
    <div aria-busy="true" className="pt-16">
      <span className="sr-only">Loading…</span>
      <QuotationDocumentSkeleton />
    </div>
  )
}
