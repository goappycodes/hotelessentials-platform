import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageContainer } from "@/components/layout/page-container";
import {
  PageHeader,
  PageHeaderSkeleton,
  type BreadcrumbEntry,
} from "@/components/layout/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { Badge } from "@/components/ui/badge";
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation";
import {
  CustomerForm,
  CustomerFormSkeleton,
} from "@/features/customers/components/customer-form";
import { DeleteCustomerButton } from "@/features/customers/components/delete-customer-button";
import { toCustomerInput } from "@/features/customers/customer-input";
import { getCustomerFormOptions } from "@/features/customers/queries";
import { hasAccess } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createRequestClient } from "@/lib/supabase/server";

const navItem = MODULE_NAV_ITEMS.customers;

export const metadata: Metadata = { title: "Customer" };

function breadcrumbs(name: string): BreadcrumbEntry[] {
  return [
    { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
    { label: navItem.title, href: navItem.href },
    { label: name },
  ];
}

export default function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  return (
    <PageContainer className="w-full">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <CustomerFormSkeleton />
          </>
        }
      >
        <CustomerDetails params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function CustomerDetails({
  params,
}: Pick<PageProps<"/customers/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()]);

  if (!hasAccess(session, navItem.access)) {
    return (
      <>
        <PageHeader title="Customer" breadcrumbs={breadcrumbs("Customer")} />
        <AccessDenied area={navItem.title} />
      </>
    );
  }

  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createRequestClient();
  const [customerResult, contactsResult, options] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("customer_contacts")
      .select("*")
      .eq("customer_id", id)
      .order("sort_order"),
    getCustomerFormOptions(supabase),
  ]);
  if (customerResult.error || contactsResult.error)
    throw new Error("Failed to load the customer");

  const customer = customerResult.data;
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        title={customer.display_name}
        description={[customer.customer_type, customer.company_name]
          .filter(Boolean)
          .join(" · ")}
        breadcrumbs={breadcrumbs(customer.display_name)}
        actions={
          <div className="flex items-center gap-3">
            {!customer.is_active && (
              <Badge variant="destructive">Inactive</Badge>
            )}
            {hasAccess(session, navItem.access, "delete") && (
              <DeleteCustomerButton
                customerId={customer.id}
                name={customer.display_name}
              />
            )}
          </div>
        }
      />
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        options={options}
        defaultValues={toCustomerInput(customer, contactsResult.data)}
        readOnly={!hasAccess(session, navItem.access, "edit")}
      />
    </>
  );
}
