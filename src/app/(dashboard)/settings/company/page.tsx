import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { AccessGate } from "@/components/shared/access-gate"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { COMPANY_ASSETS_BUCKET } from "@/constants/quotations"
import {
  CompanyProfileCard,
  CompanyProfileCardSkeleton,
} from "@/features/company/components/company-profile-card"
import { isAdminRole } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.company

export const metadata: Metadata = { title: navItem.title }

export default function CompanyPage() {
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
      <Suspense fallback={<CompanyProfileCardSkeleton />}>
        <AccessGate scope={navItem.access} denied={<AccessDenied area="company details" />}>
          <CompanyProfile />
        </AccessGate>
      </Suspense>
    </PageContainer>
  )
}

async function CompanyProfile() {
  const [supabase, session] = await Promise.all([createRequestClient(), requireUser()])
  const { data } = await supabase
    .from("organization_settings")
    .select(
      "company_name, address, address_2, phone, email, gstin, pan, bank_details, logo_path, signature_path"
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
  )
}
