import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"

import { AccessDenied } from "@/components/shared/access-denied"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"
import { DespatchDocument } from "@/features/despatch/components/despatch-document"
import { getDespatchDocument } from "@/features/despatch/queries"
import { PrintToolbar } from "@/features/quotations/components/print-toolbar"
import { QuotationDocumentSkeleton } from "@/features/quotations/components/quotation-panel"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.despatch

export const metadata: Metadata = { title: "Print despatch note" }

// A despatch note on its own page, without the app around it, for printing or saving as PDF.
export default function PrintDespatchPage({ params }: PageProps<"/print/despatch/[id]">) {
  return (
    <main className="min-h-svh bg-muted/40 px-4 pb-8 print:bg-white print:p-0">
      <style>{"@page { size: A4; margin: 13pt 0; }"}</style>
      <Suspense fallback={<PrintDespatchSkeleton />}>
        <PrintDespatch params={params} />
      </Suspense>
    </main>
  )
}

async function PrintDespatch({ params }: Pick<PageProps<"/print/despatch/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()])
  if (!hasAccess(session, navItem.access)) return <AccessDenied area={navItem.title} />
  if (!z.uuid().safeParse(id).success) notFound()

  const data = await getDespatchDocument(await createRequestClient(), id)
  if (!data) notFound()

  return (
    <>
      <PrintToolbar title={data.despatch.despatch_number} />
      <div className="mx-auto max-w-[210mm] border bg-white shadow-sm print:border-0 print:shadow-none">
        <DespatchDocument data={data} showStatus={false} className="print:w-full print:py-0" />
      </div>
    </>
  )
}

function PrintDespatchSkeleton() {
  return (
    <div aria-busy="true" className="pt-16">
      <span className="sr-only">Loading…</span>
      <QuotationDocumentSkeleton />
    </div>
  )
}
