import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { FreshForm } from "@/components/shared/fresh-form";
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation";
import {
  PriceListForm,
  PriceListFormSkeleton,
} from "@/features/price-lists/components/price-list-form";
import { getPriceListItemOptions } from "@/features/price-lists/queries";
import { hasAccess } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createRequestClient } from "@/lib/supabase/server";

const navItem = MODULE_NAV_ITEMS.priceLists;

export const metadata: Metadata = { title: navItem.create.title };

export default function NewPriceListPage() {
  return (
    <PageContainer className="w-full">
      <PageHeader
        title={navItem.create.title}
        description="Offer different rates to different customers or vendors."
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title, href: navItem.href },
          { label: navItem.create.title },
        ]}
      />
      <Suspense fallback={<PriceListFormSkeleton />}>
        <NewPriceListForm />
      </Suspense>
    </PageContainer>
  );
}

async function NewPriceListForm() {
  const session = await requireUser();
  if (!hasAccess(session, navItem.access, "create")) {
    return <AccessDenied area="creating price lists" />;
  }

  const items = await getPriceListItemOptions(await createRequestClient());
  return (
    <FreshForm>
      <PriceListForm mode="create" items={items} />
    </FreshForm>
  );
}
