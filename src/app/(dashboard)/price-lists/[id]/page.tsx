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
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation";
import {
  PriceListForm,
  PriceListFormSkeleton,
} from "@/features/price-lists/components/price-list-form";
import { getPriceListItemOptions } from "@/features/price-lists/queries";
import { toMoneyInput } from "@/lib/format";
import { hasAccess } from "@/lib/permissions";
import { describeAdjustment } from "@/lib/price-lists";
import { requireUser } from "@/lib/session";
import { createRequestClient } from "@/lib/supabase/server";
import type { PriceListInput } from "@/lib/validations/price-list";

const navItem = MODULE_NAV_ITEMS.priceLists;

export const metadata: Metadata = { title: "Price List" };

function breadcrumbs(name: string): BreadcrumbEntry[] {
  return [
    { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
    { label: navItem.title, href: navItem.href },
    { label: name },
  ];
}

export default function PriceListPage({
  params,
}: PageProps<"/price-lists/[id]">) {
  return (
    <PageContainer className="w-full">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <PriceListFormSkeleton />
          </>
        }
      >
        <PriceListDetails params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function PriceListDetails({
  params,
}: Pick<PageProps<"/price-lists/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()]);

  if (!hasAccess(session, navItem.access)) {
    return (
      <>
        <PageHeader
          title="Price List"
          breadcrumbs={breadcrumbs("Price List")}
        />
        <AccessDenied area={navItem.title} />
      </>
    );
  }

  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createRequestClient();
  const [listResult, ratesResult, items] = await Promise.all([
    supabase.from("price_lists").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("price_list_items")
      .select("item_id, rate")
      .eq("price_list_id", id),
    getPriceListItemOptions(supabase),
  ]);
  if (listResult.error || ratesResult.error)
    throw new Error("Failed to load the price list");

  const list = listResult.data;
  if (!list) notFound();

  const defaultValues: PriceListInput = {
    name: list.name,
    transactionType: list.transaction_type,
    priceListType: list.price_list_type,
    description: list.description ?? "",
    percentageType: list.percentage_type ?? "Markup",
    percentageValue:
      list.percentage_value === null ? "" : String(list.percentage_value),
    roundOffTo: list.round_off_to,
    decimalPlaces: String(
      list.decimal_places ?? 2,
    ) as PriceListInput["decimalPlaces"],
    itemRates: Object.fromEntries(
      ratesResult.data.map((entry) => [
        entry.item_id,
        toMoneyInput(entry.rate),
      ]),
    ),
    isActive: list.is_active,
  };

  return (
    <>
      <PageHeader
        title={list.name}
        description={[
          list.transaction_type,
          describeAdjustment(list.percentage_type, list.percentage_value) ??
            list.price_list_type,
        ].join(" · ")}
        breadcrumbs={breadcrumbs(list.name)}
      />
      <PriceListForm
        mode="edit"
        priceListId={list.id}
        items={items}
        defaultValues={defaultValues}
        readOnly={!hasAccess(session, navItem.access, "edit")}
      />
    </>
  );
}
