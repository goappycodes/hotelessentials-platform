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
import { ADJUSTMENT_ACCOUNTS } from "@/constants/inventory";
import {
  AdjustmentForm,
  AdjustmentFormSkeleton,
} from "@/features/inventory-adjustments/components/adjustment-form";
import { AdjustmentStatusBadge } from "@/features/inventory-adjustments/components/adjustments-table";
import { DeleteAdjustmentButton } from "@/features/inventory-adjustments/components/delete-adjustment-button";
import { getAdjustmentItemOptions } from "@/features/inventory-adjustments/queries";
import { formatDay, toMoneyInput } from "@/lib/format";
import { hasAccess } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createRequestClient } from "@/lib/supabase/server";
import type { InventoryAdjustmentInput } from "@/lib/validations/inventory-adjustment";

const navItem = MODULE_NAV_ITEMS.inventoryAdjustments;

export const metadata: Metadata = { title: "Inventory Adjustment" };

function breadcrumbs(title: string): BreadcrumbEntry[] {
  return [
    { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
    { label: navItem.title, href: navItem.href },
    { label: title },
  ];
}

export default function AdjustmentPage({
  params,
}: PageProps<"/inventory/adjustments/[id]">) {
  return (
    <PageContainer className="w-full">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <AdjustmentFormSkeleton />
          </>
        }
      >
        <AdjustmentDetails params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function AdjustmentDetails({
  params,
}: Pick<PageProps<"/inventory/adjustments/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()]);

  if (!hasAccess(session, navItem.access)) {
    return (
      <>
        <PageHeader
          title="Inventory Adjustment"
          breadcrumbs={breadcrumbs("Adjustment")}
        />
        <AccessDenied area={navItem.title} />
      </>
    );
  }

  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createRequestClient();
  const [adjustmentResult, linesResult, items] = await Promise.all([
    supabase
      .from("inventory_adjustments")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("inventory_adjustment_items")
      .select("item_id, quantity_adjusted")
      .eq("adjustment_id", id)
      .order("sort_order"),
    getAdjustmentItemOptions(supabase),
  ]);
  if (adjustmentResult.error || linesResult.error) {
    throw new Error("Failed to load the adjustment");
  }

  const adjustment = adjustmentResult.data;
  if (!adjustment) notFound();

  const defaultValues: InventoryAdjustmentInput = {
    mode: adjustment.mode,
    referenceNumber: adjustment.reference_number ?? "",
    date: adjustment.adjustment_date,
    // Accounts typed elsewhere fall back to the default one.
    account:
      ADJUSTMENT_ACCOUNTS.find((account) => account === adjustment.account) ??
      "Cost of Goods Sold",
    reason: adjustment.reason ?? "",
    description: adjustment.description ?? "",
    items: linesResult.data.map((line) => ({
      itemId: line.item_id,
      quantityAdjusted:
        (line.quantity_adjusted > 0 ? "+" : "") +
        toMoneyInput(line.quantity_adjusted),
    })),
  };
  const title = adjustment.reference_number
    ? `Adjustment ${adjustment.reference_number}`
    : `Adjustment on ${formatDay(adjustment.adjustment_date)}`;

  return (
    <>
      <PageHeader
        title={title}
        description={[adjustment.reason, adjustment.mode].filter(Boolean).join(" · ")}
        breadcrumbs={breadcrumbs(title)}
        actions={
          <div className="flex items-center gap-3">
            <AdjustmentStatusBadge status={adjustment.status} />
            {hasAccess(session, navItem.access, "delete") && (
              <DeleteAdjustmentButton
                adjustmentId={adjustment.id}
                status={adjustment.status}
                itemIds={linesResult.data.map((line) => line.item_id)}
              />
            )}
          </div>
        }
      />
      <AdjustmentForm
        mode="edit"
        adjustmentId={adjustment.id}
        status={adjustment.status}
        items={items}
        defaultValues={defaultValues}
        readOnly={!hasAccess(session, navItem.access, "edit")}
      />
    </>
  );
}
