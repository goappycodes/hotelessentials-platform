import type { Metadata } from "next"
import { Suspense } from "react"
import { z } from "zod"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { FreshForm } from "@/components/shared/fresh-form"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { SALES_ORDER_PARAM } from "@/constants/routes"
import { DespatchForm, DespatchFormSkeleton } from "@/features/despatch/components/despatch-form"
import { getDespatchOrder, getDespatchOrderOptions } from "@/features/despatch/queries"
import { todayInIndia } from "@/features/quotations/quotation-input"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.despatch

export const metadata: Metadata = { title: navItem.create.title }

export default function NewDespatchPage({ searchParams }: PageProps<"/despatch/add">) {
  return (
    <PageContainer className="w-full">
      <PageHeader
        title={navItem.create.title}
        description="Packed goods stay in stock. Stock goes down when they are despatched."
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title, href: navItem.href },
          { label: navItem.create.title },
        ]}
      />
      <Suspense fallback={<DespatchFormSkeleton />}>
        <NewDespatchForm searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function NewDespatchForm({
  searchParams,
}: Pick<PageProps<"/despatch/add">, "searchParams">) {
  const [params, session] = await Promise.all([searchParams, requireUser()])
  if (!hasAccess(session, navItem.access, "create")) {
    return <AccessDenied area="creating despatches" />
  }

  const supabase = await createRequestClient()
  const orderId = z.uuid().safeParse(params[SALES_ORDER_PARAM])
  const [options, order] = await Promise.all([
    getDespatchOrderOptions(supabase),
    orderId.success ? getDespatchOrder(supabase, orderId.data) : null,
  ])

  return (
    <FreshForm>
      <DespatchForm options={options} order={order} today={todayInIndia()} />
    </FreshForm>
  )
}
