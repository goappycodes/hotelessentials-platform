"use client"

import { FileText, Plus } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { countQuotations } from "@/actions/quotations"
import { PageContainer } from "@/components/layout/page-container"
import { ListFilterMenu } from "@/components/shared/list-filter-menu"
import { ListPagination } from "@/components/shared/list-pagination"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"
import { QUOTATION_PARAM } from "@/constants/routes"
import { QuotationPanel } from "@/features/quotations/components/quotation-panel"
import { QuotationsSideList } from "@/features/quotations/components/quotations-side-list"
import { QuotationsTable } from "@/features/quotations/components/quotations-table"
import {
  QUOTATION_STATUS_FILTER_OPTIONS,
  QUOTATIONS_LIST,
} from "@/features/quotations/list-config"
import type { Enums } from "@/types/database"

const navItem = MODULE_NAV_ITEMS.quotations

export type QuotationRow = {
  id: string
  quoteDate: string
  quoteNumber: string
  referenceNumber: string | null
  customerName: string
  status: Enums<"quotation_status">
  isExpired: boolean
  total: number
}

// The Quotations page. Clicking a quotation opens it beside the list without leaving the
// page: only the URL's ?quote= changes (history.pushState), so Back and shared links work.
export function QuotationsWorkspace({
  rows,
  hasNextPage,
  isFiltered,
  canCreate,
  canEdit,
  canDelete,
  header,
}: {
  rows: QuotationRow[]
  hasNextPage: boolean
  isFiltered: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  // The page title and actions shown above the full list.
  header: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openId = searchParams.get(QUOTATION_PARAM)

  function hrefFor(quotationId: string | null) {
    const params = new URLSearchParams(searchParams)
    if (quotationId) params.set(QUOTATION_PARAM, quotationId)
    else params.delete(QUOTATION_PARAM)
    const search = params.toString()
    return search ? `${pathname}?${search}` : pathname
  }

  function open(event: React.MouseEvent<HTMLAnchorElement>, quotationId: string) {
    // Let Ctrl/Cmd/Shift-click open a new tab or window as usual.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    window.history.pushState(null, "", hrefFor(quotationId))
  }

  function close() {
    window.history.pushState(null, "", hrefFor(null))
  }

  // Reload the list rows from the server after a change in the panel.
  const refreshList = useCallback(() => router.refresh(), [router])

  if (openId) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
        <aside className="hidden w-80 shrink-0 flex-col border-r bg-card lg:flex">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <h2 className="flex-1 truncate font-semibold">All Quotations</h2>
            {canCreate && (
              <Button asChild size="icon-sm" aria-label={navItem.create.title}>
                <Link href={navItem.create.href}>
                  <Plus />
                </Link>
              </Button>
            )}
          </div>
          <QuotationsSideList rows={rows} openId={openId} hrefFor={hrefFor} onOpen={open} />
        </aside>
        <section className="min-w-0 flex-1 overflow-y-auto">
          <QuotationPanel
            quotationId={openId}
            previewTitle={rows.find((quote) => quote.id === openId)?.quoteNumber}
            canEdit={canEdit}
            canDelete={canDelete}
            onClose={close}
            onListChange={refreshList}
          />
        </section>
      </div>
    )
  }

  return (
    <PageContainer>
      {header}
      <div className="flex flex-wrap gap-2">
        <ListFilterMenu
          config={QUOTATIONS_LIST}
          filterKey="status"
          label="Status"
          options={QUOTATION_STATUS_FILTER_OPTIONS}
        />
      </div>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>{isFiltered ? "No quotations found" : "No quotations yet"}</EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No quotations match your search or filters."
                  : "Send customers a quote for the items they want."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <QuotationsTable rows={rows} hrefFor={hrefFor} onOpen={open} />
        )}
      </Card>
      <ListPagination
        config={QUOTATIONS_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countQuotations}
      />
    </PageContainer>
  )
}
