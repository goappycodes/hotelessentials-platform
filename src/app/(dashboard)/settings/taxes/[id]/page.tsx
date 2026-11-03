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
import { TaxForm, TaxFormSkeleton } from "@/features/taxes/components/tax-form"
import { formatTaxBreakdown, TAX_RATE_COLUMNS } from "@/features/taxes/tax-rates"
import { isAdminRole } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.taxes

export const metadata: Metadata = { title: "Edit Tax" }

function breadcrumbs(name: string): BreadcrumbEntry[] {
  return [
    { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
    { label: navItem.title, href: navItem.href },
    { label: name },
  ]
}

function toInput(value: number | null) {
  return value === null ? "" : String(value)
}

export default function EditTaxPage({ params }: PageProps<"/settings/taxes/[id]">) {
  return (
    <PageContainer className="max-w-3xl">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <TaxFormSkeleton />
          </>
        }
      >
        <EditTax params={params} />
      </Suspense>
    </PageContainer>
  )
}

async function EditTax({ params }: Pick<PageProps<"/settings/taxes/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()])

  if (!isAdminRole(session.role)) {
    return (
      <>
        <PageHeader title="Edit Tax" breadcrumbs={breadcrumbs("Edit Tax")} />
        <AccessDenied area="tax settings" />
      </>
    )
  }

  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createRequestClient()
  const { data: tax, error } = await supabase
    .from("tax_rates")
    .select(TAX_RATE_COLUMNS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("Failed to load the tax")
  if (!tax) notFound()

  return (
    <>
      <PageHeader
        title={tax.name}
        description={`${tax.tax_scope} · ${formatTaxBreakdown(tax)}`}
        breadcrumbs={breadcrumbs(tax.name)}
      />
      <TaxForm
        mode="edit"
        taxId={tax.id}
        defaultValues={{
          name: tax.name,
          taxScope: tax.tax_scope,
          cgstRate: toInput(tax.cgst_rate),
          sgstRate: toInput(tax.sgst_rate),
          igstRate: toInput(tax.igst_rate),
          isActive: tax.is_active,
        }}
      />
    </>
  )
}
