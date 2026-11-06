import { Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { AccessGate } from "@/components/shared/access-gate"
import { Button } from "@/components/ui/button"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { BusinessStateCard } from "@/features/taxes/components/business-state-card"
import { TaxesTable, TaxesTableSkeleton } from "@/features/taxes/components/taxes-table"
import { createRequestClient } from "@/lib/supabase/server"

async function BusinessState() {
  const supabase = await createRequestClient()
  const { data } = await supabase
    .from("organization_settings")
    .select("gst_state_code")
    .maybeSingle()

  return <BusinessStateCard stateCode={data?.gst_state_code ?? null} />
}

const navItem = MODULE_NAV_ITEMS.taxes

export const metadata: Metadata = { title: navItem.title }

export default function TaxesPage() {
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
        actions={
          <Suspense>
            <AccessGate scope={navItem.access}>
              <Button asChild>
                <Link href={navItem.create.href}>
                  <Plus />
                  New Tax
                </Link>
              </Button>
            </AccessGate>
          </Suspense>
        }
      />
      <Suspense fallback={<TaxesTableSkeleton />}>
        <AccessGate scope={navItem.access} denied={<AccessDenied area="tax settings" />}>
          <BusinessState />
          <TaxesTable />
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}
