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
import { COMPANY_ASSETS_BUCKET } from "@/constants/quotations"
import { BusinessStateCard } from "@/features/taxes/components/business-state-card"
import { CompanyProfileCard } from "@/features/taxes/components/company-profile-card"
import { TaxesTable, TaxesTableSkeleton } from "@/features/taxes/components/taxes-table"
import { isAdminRole } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

async function BusinessState() {
  const [supabase, session] = await Promise.all([createRequestClient(), requireUser()])
  const { data } = await supabase
    .from("organization_settings")
    .select(
      "gst_state_code, company_name, address, address_2, phone, email, gstin, pan, bank_details, logo_path, signature_path"
    )
    .maybeSingle()
  const paths = [data?.logo_path, data?.signature_path].filter((path): path is string =>
    Boolean(path)
  )
  const { data: links } = paths.length
    ? await supabase.storage.from(COMPANY_ASSETS_BUCKET).createSignedUrls(paths, 60 * 60)
    : { data: [] }
  const urlFor = (path: string | null | undefined) =>
    (path && links?.find((link) => link.path === path)?.signedUrl) || null

  return (
    <>
      <BusinessStateCard stateCode={data?.gst_state_code ?? null} />
      <CompanyProfileCard
        canEdit={isAdminRole(session.role)}
        logoUrl={urlFor(data?.logo_path)}
        signatureUrl={urlFor(data?.signature_path)}
        defaultValues={{
          companyName: data?.company_name ?? "",
          address: data?.address ?? "",
          address2: data?.address_2 ?? "",
          phone: data?.phone ?? "",
          email: data?.email ?? "",
          gstin: data?.gstin ?? "",
          pan: data?.pan ?? "",
          bankDetails: data?.bank_details ?? "",
        }}
      />
    </>
  )
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
