"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Info } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { saveInventoryAdjustment } from "@/actions/inventory-adjustments"
import { FormComboboxField } from "@/components/shared/form-combobox-field"
import { FormError } from "@/components/shared/form-error"
import {
  FieldHint,
  FormFieldLabel,
  HORIZONTAL_FIELD_CLASS,
} from "@/components/shared/form-field-label"
import { FormInputField } from "@/components/shared/form-input-field"
import { FormSelectField, toSelectOptions } from "@/components/shared/form-select-field"
import { FormTextareaField } from "@/components/shared/form-textarea-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  ADJUSTMENT_ACCOUNTS,
  ADJUSTMENT_MODES,
  ADJUSTMENT_REASONS,
  type AdjustmentStatus,
} from "@/constants/inventory"
import { ROUTES, inventoryAdjustmentRoute } from "@/constants/routes"
import { AdjustmentItemsTable } from "@/features/inventory-adjustments/components/adjustment-items-table"
import type { AdjustmentItemOption } from "@/features/inventory-adjustments/queries"
import { invalidateItemDetail } from "@/features/items/item-detail-cache"
import {
  inventoryAdjustmentSchema,
  type InventoryAdjustmentInput,
} from "@/lib/validations/inventory-adjustment"

// Today in the user's time zone, as the date input expects it (YYYY-MM-DD).
function today() {
  return new Date().toLocaleDateString("en-CA")
}

export function newAdjustment(itemId?: string): InventoryAdjustmentInput {
  return {
    mode: "Quantity Adjustment",
    referenceNumber: "",
    date: today(),
    account: "Cost of Goods Sold",
    reason: "",
    description: "",
    items: [{ itemId: itemId ?? "", quantityAdjusted: "" }],
  }
}

type AdjustmentFormProps = {
  items: AdjustmentItemOption[]
} & (
  | {
      mode: "create"
      // An item to start with (Adjust Stock on an item).
      itemId?: string
    }
  | {
      mode: "edit"
      adjustmentId: string
      status: AdjustmentStatus
      defaultValues: InventoryAdjustmentInput
      // Users who can view but not edit adjustments.
      readOnly: boolean
    }
)

export function AdjustmentForm(props: AdjustmentFormProps) {
  const { mode, items } = props
  const readOnly = mode === "edit" && props.readOnly
  const isAdjusted = mode === "edit" && props.status === "Adjusted"
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [savingAs, setSavingAs] = useState<AdjustmentStatus>()
  const [error, setError] = useState<string>()

  const form = useForm<InventoryAdjustmentInput>({
    resolver: zodResolver(inventoryAdjustmentSchema),
    // A new adjustment's date is today in the browser, so it is set on the client.
    defaultValues: mode === "edit" ? props.defaultValues : newAdjustment(props.itemId),
  })
  const reason = useWatch({ control: form.control, name: "reason" })
  const reasonOptions = toSelectOptions(
    reason && !ADJUSTMENT_REASONS.includes(reason) ? [...ADJUSTMENT_REASONS, reason] : ADJUSTMENT_REASONS
  )

  // What this adjustment already added or removed, when it is adjusted: the quantity
  // available before it is stock on hand without that.
  const savedChanges = new Map(
    isAdjusted
      ? props.defaultValues.items.map((line) => [line.itemId, Number(line.quantityAdjusted)])
      : []
  )
  function availableFor(itemId: string) {
    const item = items.find((option) => option.id === itemId)
    return (item?.stock_on_hand ?? 0) - (savedChanges.get(itemId) ?? 0)
  }

  function save(status: AdjustmentStatus) {
    return form.handleSubmit((values) => {
      setError(undefined)
      setSavingAs(status)
      startTransition(async () => {
        const result = await saveInventoryAdjustment(
          mode === "edit" ? props.adjustmentId : null,
          values,
          status
        )
        if (!result.success) {
          setError(result.error)
          return
        }
        // Item panels cache their details (stock on hand) briefly; drop them.
        for (const line of values.items) if (line.itemId) invalidateItemDetail(line.itemId)
        if (mode === "edit" && isAdjusted) {
          for (const line of props.defaultValues.items) invalidateItemDetail(line.itemId)
        }

        toast.success(
          status === "Adjusted"
            ? mode === "edit" && isAdjusted
              ? "Adjustment updated."
              : "Stock adjusted."
            : "Adjustment saved as draft."
        )
        router.push(inventoryAdjustmentRoute(result.data.id))
        router.refresh()
      })
    })
  }

  const busy = readOnly || isPending

  return (
    <FormProvider {...form}>
      <form onSubmit={save(isAdjusted ? "Adjusted" : "Draft")} noValidate className="flex flex-col gap-6">
        <FormError message={error} />
        {readOnly && (
          <Alert>
            <Info />
            <AlertDescription>You can view this adjustment but not change it.</AlertDescription>
          </Alert>
        )}
        {mode === "edit" && isAdjusted && !readOnly && (
          <Alert>
            <Info />
            <AlertDescription>
              This adjustment has changed stock. Changes you save update the stock again.
            </AlertDescription>
          </Alert>
        )}
        <fieldset disabled={busy} className="contents">
          <Card className="gap-0 py-0">
            <FieldGroup className="max-w-[34rem] gap-4 p-6">
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <Field className={HORIZONTAL_FIELD_CLASS}>
                    <FormFieldLabel label="Mode of adjustment" />
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={busy}
                      aria-label="Mode of adjustment"
                      className="flex flex-col gap-2 py-1.5"
                    >
                      {ADJUSTMENT_MODES.map((option) => {
                        const unavailable = option === "Value Adjustment"
                        return (
                          <Field key={option} orientation="horizontal" className="w-auto">
                            <RadioGroupItem
                              value={option}
                              id={`mode-${option}`}
                              disabled={busy || unavailable}
                            />
                            <FieldLabel
                              htmlFor={`mode-${option}`}
                              className={unavailable ? "font-normal text-muted-foreground" : "font-normal"}
                            >
                              {option}
                            </FieldLabel>
                            {unavailable && (
                              <FieldHint
                                label={option}
                                hint="Changing the value of stock without changing its quantity comes with stock valuation."
                              />
                            )}
                          </Field>
                        )
                      })}
                    </RadioGroup>
                  </Field>
                )}
              />
              <FormInputField
                control={form.control}
                name="referenceNumber"
                label="Reference Number"
                orientation="horizontal"
                autoComplete="off"
              />
              <FormInputField
                control={form.control}
                name="date"
                label="Date"
                orientation="horizontal"
                required
                type="date"
              />
              <FormSelectField
                control={form.control}
                name="account"
                label="Account"
                orientation="horizontal"
                required
                hint="Where the cost of the stock added or removed is recorded."
                options={toSelectOptions(ADJUSTMENT_ACCOUNTS)}
                disabled={busy}
              />
              <FormComboboxField
                control={form.control}
                name="reason"
                label="Reason"
                orientation="horizontal"
                required
                placeholder="Select a reason"
                searchPlaceholder="Search or type a reason"
                options={reasonOptions}
                onCreate={(value) =>
                  form.setValue("reason", value.slice(0, 100), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                createLabel={(value) => `Use “${value}”`}
                disabled={busy}
              />
              <FormTextareaField
                control={form.control}
                name="description"
                label="Description"
                orientation="horizontal"
                placeholder="Max. 500 characters"
                rows={3}
              />
            </FieldGroup>

            <section className="flex flex-col gap-4 border-t p-6">
              <h3 className="font-medium">Item Table</h3>
              <AdjustmentItemsTable items={items} availableFor={availableFor} disabled={busy} />
            </section>
          </Card>
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={ROUTES.inventoryAdjustments}>{readOnly ? "Back" : "Cancel"}</Link>
          </Button>
          {!readOnly &&
            (isAdjusted ? (
              <Button type="submit" disabled={isPending}>
                {isPending && <Spinner />}
                Update
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={save("Draft")}
                >
                  {isPending && savingAs === "Draft" && <Spinner />}
                  Save as Draft
                </Button>
                <Button type="button" disabled={isPending} onClick={save("Adjusted")}>
                  {isPending && savingAs === "Adjusted" && <Spinner />}
                  Convert to Adjusted
                </Button>
              </>
            ))}
        </div>
      </form>
    </FormProvider>
  )
}

export function AdjustmentFormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="gap-0 py-0">
        <div className="flex max-w-[34rem] flex-col gap-4 p-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 border-t p-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-8 w-32" />
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-36" />
      </div>
    </div>
  )
}
