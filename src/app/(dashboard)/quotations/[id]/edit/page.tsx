import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"

import { PageContainer } from "@/components/layout/page-container"
import {
  PageHeader,
  PageHeaderSkeleton,
  type BreadcrumbEntry,
} from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { quotationRoute } from "@/constants/routes"
import {
  QuotationForm,
  QuotationFormSkeleton,
} from "@/features/quotations/components/quotation-form"
import {
  isQuotationExpired,
  QuotationStatusBadge,
} from "@/features/quotations/components/quotation-status-badge"
import {
  getQuotationAttachments,
  getQuotationFormOptions,
} from "@/features/quotations/queries"
import { todayInIndia, toQuotationInput } from "@/features/quotations/quotation-input"
import { formatCurrency } from "@/lib/format"
import { hasAccess, isAdminRole } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.quotations

export const metadata: Metadata = { title: "Quotation" }

function breadcrumbs(quote?: { id: string; quote_number: string }): BreadcrumbEntry[] {
  return [
    { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
    { label: navItem.title, href: navItem.href },
    ...(quote ? [{ label: quote.quote_number, href: quotationRoute(quote.id) }] : []),
    { label: "Edit" },
  ]
}

export default function QuotationPage({ params }: PageProps<"/quotations/[id]/edit">) {
  return (
    <PageContainer className="w-full">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <QuotationFormSkeleton />
          </>
        }
      >
        <QuotationDetails params={params} />
      </Suspense>
    </PageContainer>
  )
}

async function QuotationDetails({ params }: Pick<PageProps<"/quotations/[id]/edit">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()])

  if (!hasAccess(session, navItem.access)) {
    return (
      <>
        <PageHeader title="Edit Quotation" breadcrumbs={breadcrumbs()} />
        <AccessDenied area={navItem.title} />
      </>
    )
  }

  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createRequestClient()
  const [quoteResult, linesResult, options] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("quotation_items")
      .select("*, item:items(intra_state_tax_id, inter_state_tax_id)")
      .eq("quotation_id", id)
      .order("sort_order"),
    getQuotationFormOptions(supabase),
  ])
  const attachments = quoteResult.data ? await getQuotationAttachments(supabase, id) : []
  if (quoteResult.error || linesResult.error) throw new Error("Failed to load the quotation")

  const quote = quoteResult.data
  if (!quote) notFound()

  return (
    <>
      <PageHeader
        title={`Edit ${quote.quote_number}`}
        description={`${quote.customer_name} · ${formatCurrency(quote.total)}`}
        breadcrumbs={breadcrumbs(quote)}
        actions={
          <QuotationStatusBadge
            status={quote.status}
            isExpired={isQuotationExpired(quote, todayInIndia())}
          />
        }
      />
      <QuotationForm
        mode="edit"
        canManageDirectTaxes={isAdminRole(session.role)}
        quotationId={quote.id}
        options={options}
        defaultValues={toQuotationInput(quote, linesResult.data)}
        attachments={attachments}
        readOnly={!hasAccess(session, navItem.access, "edit")}
      />
    </>
  )
}
