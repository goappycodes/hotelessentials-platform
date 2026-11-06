"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"

import { createSalesOrder } from "@/actions/sales-orders"
import { FormComboboxField } from "@/components/shared/form-combobox-field"
import { FormError } from "@/components/shared/form-error"
import { HORIZONTAL_FIELD_CLASS } from "@/components/shared/form-field-label"
import { FormInputField } from "@/components/shared/form-input-field"
import { FormTextareaField } from "@/components/shared/form-textarea-field"
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { ROUTES, salesOrderRoute } from "@/constants/routes"
import {
  PLACE_OF_SUPPLY_OPTIONS,
  Totals,
} from "@/features/quotations/components/quotation-form"
import { QuotationItemsTable } from "@/features/quotations/components/quotation-items-table"
import { QuoteCustomerField } from "@/features/quotations/components/quote-customer-field"
import { useQuotationCalculations } from "@/features/quotations/components/use-quotation-calculations"
import type { QuotationFormOptions, QuoteCustomer } from "@/features/quotations/queries"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import { quotationSchema, type QuotationInput } from "@/lib/validations/quotation"

type NewOrderStatus = "Draft" | "Confirmed"

// New Sales Order, for an order that didn't come from a quotation: the quotation form's
// customer, items, pricing and totals, with the SO number assigned when saved.
export function SalesOrderForm({
  options,
  defaultValues,
}: {
  options: QuotationFormOptions
  defaultValues: QuotationInput
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [savingAs, setSavingAs] = useState<NewOrderStatus>()
  const [error, setError] = useState<string>()
  const [customer, setCustomer] = useState<QuoteCustomer | null>(null)

  const form = useForm<QuotationInput>({
    resolver: zodResolver(quotationSchema),
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues,
  })
  const { control } = form
  const { values, totals, isOverseas, dropEmptyLines } = useQuotationCalculations({
    form,
    customer,
    options,
  })

  function save(status: NewOrderStatus) {
    const submit = form.handleSubmit((input) => {
      setError(undefined)
      setSavingAs(status)
      startTransition(async () => {
        const result = await createSalesOrder(input, status)
        if (!result.success) {
          setError(result.error)
          return
        }
        toast.success(status === "Confirmed" ? "Sales order confirmed." : "Sales order saved as draft.")
        router.push(salesOrderRoute(result.data.id))
        router.refresh()
      })
    }, scrollToFirstInvalid)

    return (event?: React.BaseSyntheticEvent) => {
      dropEmptyLines()
      return submit(event)
    }
  }

  const salespersonOptions = [
    { value: "", label: "None" },
    ...options.salespeople
      .filter((person) => person.isActive || person.id === values.salespersonId)
      .map((person) => ({ value: person.id, label: person.name })),
  ]
  const priceListOptions = [
    { value: "", label: "None (selling prices)" },
    ...options.priceLists
      .filter((list) => list.is_active || list.id === values.priceListId)
      .map((list) => ({ value: list.id, label: list.name })),
  ]

  return (
    <FormProvider {...form}>
      <UnsavedChangesGuard when={!isPending && form.formState.isDirty} />
      <form onSubmit={save("Draft")} noValidate className="flex flex-col gap-6">
        <FormError message={error} />
        <fieldset disabled={isPending} className="contents">
          <Card className="gap-0 py-0">
            <FieldGroup className="max-w-3xl gap-4 p-6">
              <QuoteCustomerField
                selected={customer}
                onSelectedChange={setCustomer}
                disabled={isPending}
              />
              {customer && (
                <div className={HORIZONTAL_FIELD_CLASS}>
                  <span aria-hidden="true" />
                  <p className="text-xs text-muted-foreground">
                    {[
                      customer.gst_treatment,
                      customer.gstin && `GSTIN ${customer.gstin}`,
                      customer.email,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No GST details on this customer."}
                  </p>
                </div>
              )}
              <FormComboboxField
                control={control}
                name="placeOfSupply"
                label="Place of Supply"
                orientation="horizontal"
                hint="Taken from the customer. Same state as your business: CGST + SGST; another state: IGST."
                placeholder="Select a state"
                searchPlaceholder="Search states"
                options={PLACE_OF_SUPPLY_OPTIONS}
                disabled={isPending}
              />
              <FormInputField
                control={control}
                name="referenceNumber"
                label="Reference#"
                orientation="horizontal"
                autoComplete="off"
              />
              <FormInputField
                control={control}
                name="quoteDate"
                label="Order Date"
                orientation="horizontal"
                required
                type="date"
              />
              <FormComboboxField
                control={control}
                name="salespersonId"
                label="Salesperson"
                orientation="horizontal"
                placeholder="Select a salesperson"
                searchPlaceholder="Search users"
                options={salespersonOptions}
                disabled={isPending}
              />
              <FormComboboxField
                control={control}
                name="priceListId"
                label="Price List"
                orientation="horizontal"
                hint="The price list every line starts with (taken from the customer). Changing it re-prices all items; each line can pick its own."
                placeholder="None (selling prices)"
                searchPlaceholder="Search price lists"
                options={priceListOptions}
                disabled={isPending}
              />
              <FormTextareaField
                control={control}
                name="subject"
                label="Subject"
                orientation="horizontal"
                placeholder="What this order is for"
                rows={2}
              />
            </FieldGroup>

            <section className="border-t p-6">
              <QuotationItemsTable
                taxes={options.taxes}
                priceLists={options.priceLists}
                lineAmounts={totals.lineAmounts}
                businessState={options.businessState}
                isOverseas={isOverseas}
                disabled={isPending}
                notes={
                  <FormTextareaField
                    control={control}
                    name="notes"
                    label="Customer Notes"
                    placeholder="Will be displayed on the sales order"
                    rows={2}
                  />
                }
                totals={<Totals totals={totals} disabled={isPending} />}
              />
            </section>

            <section className="border-t bg-muted/40 p-6">
              <FormTextareaField
                control={control}
                name="terms"
                label="Terms & Conditions"
                placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                rows={5}
              />
            </section>
          </Card>
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={ROUTES.salesOrders}>Cancel</Link>
          </Button>
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending && savingAs === "Draft" && <Spinner />}
            Save as Draft
          </Button>
          <Button type="button" disabled={isPending} onClick={save("Confirmed")}>
            {isPending && savingAs === "Confirmed" && <Spinner />}
            Save and Confirm
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
