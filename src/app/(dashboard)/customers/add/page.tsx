import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation";
import {
  CustomerForm,
  CustomerFormSkeleton,
} from "@/features/customers/components/customer-form";
import { newCustomerInput } from "@/features/customers/customer-input";
import { getCustomerFormOptions } from "@/features/customers/queries";
import { hasAccess } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createRequestClient } from "@/lib/supabase/server";

const navItem = MODULE_NAV_ITEMS.customers;

export const metadata: Metadata = { title: navItem.create.title };

export default function NewCustomerPage() {
  return (
    <PageContainer className="w-full">
      <PageHeader
        title={navItem.create.title}
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title, href: navItem.href },
          { label: navItem.create.title },
        ]}
      />
      <Suspense fallback={<CustomerFormSkeleton />}>
        <NewCustomerForm />
      </Suspense>
    </PageContainer>
  );
}

async function NewCustomerForm() {
  const session = await requireUser();
  if (!hasAccess(session, navItem.access, "create")) {
    return <AccessDenied area="creating customers" />;
  }

  const options = await getCustomerFormOptions(await createRequestClient());
  // The person adding the customer owns it, unless they pick someone else.
  return (
    <CustomerForm
      mode="create"
      options={options}
      defaultValues={newCustomerInput(session.user.id)}
    />
  );
}
