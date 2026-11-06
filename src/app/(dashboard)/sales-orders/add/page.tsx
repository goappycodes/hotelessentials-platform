import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { QuotationFormSkeleton } from "@/features/quotations/components/quotation-form"
import { getQuotationFormOptions } from "@/features/quotations/queries"
import { newQuotationInput, todayInIndia } from "@/features/quotations/quotation-input"
import { SalesOrderForm } from "@/features/sales-orders/components/sales-order-form"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.salesOrders

export const metadata: Metadata = { title: navItem.create.title }

export default function NewSalesOrderPage() {
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
        <NewSalesOrderForm />
      </Suspense>
    </PageContainer>
  )
}

async function NewSalesOrderForm() {
  const session = await requireUser()
  if (!hasAccess(session, navItem.access, "create")) {
    return <AccessDenied area="creating sales orders" />
  }

  const options = await getQuotationFormOptions(await createRequestClient())
  const defaults = newQuotationInput(todayInIndia())
  // The person entering the order is its salesperson unless they pick someone else.
  defaults.salespersonId = session.user.id
  return <SalesOrderForm options={options} defaultValues={defaults} />
}
