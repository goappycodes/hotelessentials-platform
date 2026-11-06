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
import { FreshForm } from "@/components/shared/fresh-form"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import { itemRoute } from "@/constants/routes"
import { ItemForm, ItemFormSkeleton } from "@/features/items/components/item-form"
import { toItemInput } from "@/features/items/item-input"
import { getHsnCodes, getItemImages } from "@/features/items/queries"
import { getTaxRates } from "@/features/taxes/queries"
import { hasAccess } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"

const navItem = MODULE_NAV_ITEMS.items

export const metadata: Metadata = { title: "Edit Item" }

function breadcrumbs(name: string, id?: string): BreadcrumbEntry[] {
  return [
    { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
    { label: navItem.title, href: navItem.href },
    ...(id ? [{ label: name, href: itemRoute(id) }, { label: "Edit" }] : [{ label: name }]),
  ]
}

export default function EditItemPage({ params }: PageProps<"/items/[id]/edit">) {
  return (
    <PageContainer className="max-w-6xl">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <ItemFormSkeleton />
          </>
        }
      >
        <EditItem params={params} />
      </Suspense>
    </PageContainer>
  )
}

async function EditItem({ params }: Pick<PageProps<"/items/[id]/edit">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()])

  if (!hasAccess(session, navItem.access)) {
    return (
      <>
        <PageHeader title="Item" breadcrumbs={breadcrumbs("Item")} />
        <AccessDenied area={navItem.title} />
      </>
    )
  }

  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createRequestClient()
  const [itemResult, hsnCodes, taxRates, images, historyResult] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).maybeSingle(),
    getHsnCodes(supabase),
    getTaxRates(supabase),
    getItemImages(supabase, id),
    supabase
      .from("inventory_adjustment_items")
      .select("id", { count: "exact", head: true })
      .eq("item_id", id),
  ])
  if (itemResult.error || historyResult.error) throw new Error("Failed to load the item")

  const item = itemResult.data
  if (!item) notFound()

  return (
    <>
      <PageHeader
        title={`Edit ${item.name}`}
        description={[item.type, item.sku && `SKU ${item.sku}`].filter(Boolean).join(" · ")}
        breadcrumbs={breadcrumbs(item.name, item.id)}
      />
      <FreshForm>
        <ItemForm
          mode="edit"
          itemId={item.id}
          hsnCodes={hsnCodes}
          taxRates={taxRates}
          images={images}
          defaultValues={toItemInput(item)}
          readOnly={!hasAccess(session, navItem.access, "edit") || item.is_locked}
          isLocked={item.is_locked}
          hasStockHistory={(historyResult.count ?? 0) > 0}
        />
      </FreshForm>
    </>
  )
}
