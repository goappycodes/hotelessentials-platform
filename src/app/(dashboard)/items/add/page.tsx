import type { Metadata } from "next"
import { Suspense } from "react"
import { z } from "zod"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { FreshForm } from "@/components/shared/fresh-form"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { ItemForm, ItemFormSkeleton } from "@/features/items/components/item-form"
import { toClonedItemInput } from "@/features/items/item-input"
import { getHsnCodes } from "@/features/items/queries"
import { getTaxRates } from "@/features/taxes/queries"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.items

export const metadata: Metadata = { title: navItem.create.title }

export default function NewItemPage({ searchParams }: PageProps<"/items/add">) {
  return (
    <PageContainer className="w-full">
      <PageHeader
        title={navItem.create.title}
        description="Add a product or service you sell or buy."
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title, href: navItem.href },
          { label: navItem.create.title },
        ]}
      />
      <Suspense fallback={<ItemFormSkeleton />}>
        <NewItemForm searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function NewItemForm({ searchParams }: Pick<PageProps<"/items/add">, "searchParams">) {
  const [session, { clone }] = await Promise.all([requireUser(), searchParams])
  if (!hasAccess(session, navItem.access, "create")) {
    return <AccessDenied area="creating items" />
  }

  const supabase = await createRequestClient()
  // "Clone Item" opens this page with ?clone=<item id> to start from a copy.
  const cloneId = typeof clone === "string" && z.uuid().safeParse(clone).success ? clone : null
  const [hsnCodes, taxRates, source] = await Promise.all([
    getHsnCodes(supabase),
    getTaxRates(supabase),
    cloneId
      ? supabase.from("items").select("*").eq("id", cloneId).maybeSingle()
      : Promise.resolve(null),
  ])

  return (
    <FreshForm>
      <ItemForm
        mode="create"
        hsnCodes={hsnCodes}
        taxRates={taxRates}
        defaultValues={source?.data ? toClonedItemInput(source.data) : undefined}
      />
    </FreshForm>
  )
}
