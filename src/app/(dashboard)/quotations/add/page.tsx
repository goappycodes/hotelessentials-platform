import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import {
  QuotationForm,
  QuotationFormSkeleton,
} from "@/features/quotations/components/quotation-form"
import { getQuotationFormOptions } from "@/features/quotations/queries"
import { newQuotationInput, todayInIndia } from "@/features/quotations/quotation-input"
import { hasAccess, isAdminRole } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.quotations

export const metadata: Metadata = { title: navItem.create.title }

export default function NewQuotationPage() {
  return (
    <PageContainer className="w-full">
      <PageHeader
        title={navItem.create.title}
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title, href: navItem.href },
          { label: navItem.create.title },
        ]}
      />
      <Suspense fallback={<QuotationFormSkeleton />}>
        <NewQuotationForm />
      </Suspense>
    </PageContainer>
  )
}

async function NewQuotationForm() {
  const session = await requireUser()
  if (!hasAccess(session, navItem.access, "create")) {
    return <AccessDenied area="creating quotations" />
  }

  const supabase = await createRequestClient()
  const [options, nextNumber] = await Promise.all([
    getQuotationFormOptions(supabase),
    supabase.rpc("next_quote_number"),
  ])
  const suggestedQuoteNumber = nextNumber.data ?? ""
  const defaults = newQuotationInput(todayInIndia())
  defaults.quoteNumber = suggestedQuoteNumber
  // The person writing the quote is its salesperson unless they pick someone else.
  defaults.salespersonId = session.user.id
  return (
    <QuotationForm
      mode="create"
      canManageDirectTaxes={isAdminRole(session.role)}
      options={options}
      defaultValues={defaults}
      suggestedQuoteNumber={suggestedQuoteNumber}
    />
  )
}
