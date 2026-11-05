import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"

import { AccessDenied } from "@/components/shared/access-denied"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"
import { QuotationDocument } from "@/features/quotations/components/quotation-document"
import { QuotationDocumentSkeleton } from "@/features/quotations/components/quotation-panel"
import { PrintToolbar } from "@/features/quotations/components/print-toolbar"
import { getQuotationDocument } from "@/features/quotations/queries"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.quotations

export const metadata: Metadata = { title: "Print quotation" }

// A quotation on its own page, without the app around it, for printing or saving as PDF.
export default function PrintQuotationPage({ params }: PageProps<"/print/quotations/[id]">) {
  return (
    <main className="min-h-svh bg-muted/40 px-4 pb-8 print:bg-white print:p-0">
      <style>{"@page { size: A4; margin: 8mm; }"}</style>
      <Suspense fallback={<PrintQuotationSkeleton />}>
        <PrintQuotation params={params} />
      </Suspense>
    </main>
  )
}

async function PrintQuotation({ params }: Pick<PageProps<"/print/quotations/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()])
  if (!hasAccess(session, navItem.access)) return <AccessDenied area={navItem.title} />
  if (!z.uuid().safeParse(id).success) notFound()

  const data = await getQuotationDocument(await createRequestClient(), id)
  if (!data) notFound()

  return (
    <>
      <PrintToolbar title={data.quote.quote_number} />
      <div className="mx-auto max-w-[210mm] border bg-white shadow-sm print:border-0 print:shadow-none">
        <QuotationDocument data={data} showStatus={false} className="print:p-0" />
      </div>
    </>
  )
}

function PrintQuotationSkeleton() {
  return (
    <div aria-busy="true" className="pt-16">
      <span className="sr-only">Loading…</span>
      <QuotationDocumentSkeleton />
    </div>
  )
}
