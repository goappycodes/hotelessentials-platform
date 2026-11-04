import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { AccessGate } from "@/components/shared/access-gate"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import {
  DirectTaxesManager,
  DirectTaxesManagerSkeleton,
} from "@/features/direct-taxes/components/direct-taxes-manager"
import { isAdminRole } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.directTaxes

export const metadata: Metadata = { title: navItem.title }

export default function DirectTaxesPage() {
  return (
    <PageContainer>
      <PageHeader
        title={navItem.title}
        description={navItem.description}
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: "Settings" },
          { label: navItem.title },
        ]}
      />
      <Suspense fallback={<DirectTaxesManagerSkeleton />}>
        <AccessGate scope={navItem.access} denied={<AccessDenied area="direct taxes" />}>
          <DirectTaxes />
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}

async function DirectTaxes() {
  const [supabase, session] = await Promise.all([createRequestClient(), requireUser()])
  const { data, error } = await supabase
    .from("direct_tax_rates")
    .select("id, kind, name, rate, is_active")
    .order("name")
  if (error) throw new Error("Failed to load TDS and TCS rates")
  return <DirectTaxesManager rates={data} canEdit={isAdminRole(session.role)} />
}
