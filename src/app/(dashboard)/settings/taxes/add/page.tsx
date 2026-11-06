import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { AccessGate } from "@/components/shared/access-gate"
import { FreshForm } from "@/components/shared/fresh-form"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { TaxForm, TaxFormSkeleton } from "@/features/taxes/components/tax-form"

const navItem = MODULE_NAV_ITEMS.taxes

export const metadata: Metadata = { title: navItem.create.title }

export default function NewTaxPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title={navItem.create.title}
        description="Add a tax rate that items can use."
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title, href: navItem.href },
          { label: navItem.create.title },
        ]}
      />
      <Suspense fallback={<TaxFormSkeleton />}>
        <AccessGate scope={navItem.access} denied={<AccessDenied area="tax settings" />}>
          <FreshForm>
            <TaxForm mode="create" />
          </FreshForm>
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}
