import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation";
import { ITEM_PARAM } from "@/constants/routes";
import {
  AdjustmentForm,
  AdjustmentFormSkeleton,
} from "@/features/inventory-adjustments/components/adjustment-form";
import { getAdjustmentItemOptions } from "@/features/inventory-adjustments/queries";
import { hasAccess } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createRequestClient } from "@/lib/supabase/server";

const navItem = MODULE_NAV_ITEMS.inventoryAdjustments;

export const metadata: Metadata = { title: navItem.create.title };

export default function NewAdjustmentPage({
  searchParams,
}: PageProps<"/inventory/adjustments/add">) {
  return (
    <PageContainer className="w-full">
      <PageHeader
        title={navItem.create.title}
        description="Add or remove stock. Drafts don't change stock until you convert them to adjusted."
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title, href: navItem.href },
          { label: navItem.create.title },
        ]}
      />
      <Suspense fallback={<AdjustmentFormSkeleton />}>
        <NewAdjustmentForm searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function NewAdjustmentForm({
  searchParams,
}: Pick<PageProps<"/inventory/adjustments/add">, "searchParams">) {
  const [params, session] = await Promise.all([searchParams, requireUser()]);
  if (!hasAccess(session, navItem.access, "create")) {
    return <AccessDenied area="creating inventory adjustments" />;
  }

  const items = await getAdjustmentItemOptions(await createRequestClient());

  // Adjust Stock on an item starts the table with that item, when it can be adjusted.
  const requested = z.uuid().safeParse(params[ITEM_PARAM]);
  const itemId = requested.success
    ? items.find((item) => item.id === requested.data && item.is_active)?.id
    : undefined;

  return <AdjustmentForm mode="create" items={items} itemId={itemId} />;
}
