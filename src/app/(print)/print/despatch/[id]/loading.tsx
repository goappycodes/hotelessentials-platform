import { QuotationDocumentSkeleton } from "@/features/quotations/components/quotation-panel"

export default function PrintDespatchLoading() {
  return (
    <main aria-busy="true" className="min-h-svh bg-muted/40 px-4 pt-16 pb-8">
      <span className="sr-only">Loading…</span>
      <QuotationDocumentSkeleton />
    </main>
  )
}
