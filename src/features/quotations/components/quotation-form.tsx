"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Info } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { saveQuotation } from "@/actions/quotations"
import { FormAutocompleteField } from "@/components/shared/form-autocomplete-field"
import { FormComboboxField } from "@/components/shared/form-combobox-field"
import { FormError } from "@/components/shared/form-error"
import { FieldHint, HORIZONTAL_FIELD_CLASS } from "@/components/shared/form-field-label"
import { FormInputField } from "@/components/shared/form-input-field"
import { FormTextareaField } from "@/components/shared/form-textarea-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { INDIAN_STATES } from "@/constants/customers"
import { ROUTES, quotationRoute } from "@/constants/routes"
import {
  QuotationAttachmentsField,
  uploadQuotationAttachments,
  type PendingAttachment,
  type QuotationAttachmentView,
} from "@/features/quotations/components/quotation-attachments-field"
// TDS / TCS is hidden for now; this comes back with it.
// import { DirectTaxField } from "@/features/quotations/components/direct-tax-field"
import { QuotationItemsTable } from "@/features/quotations/components/quotation-items-table"
import type { QuotationFormOptions } from "@/features/quotations/queries"
import { invalidateQuotationDetail } from "@/features/quotations/quotation-detail-cache"
import { formatCurrency } from "@/lib/format"
import { computeQuotationTotals, defaultTaxIdFor } from "@/lib/quotations"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import { quotationSchema, type QuotationInput } from "@/lib/validations/quotation"
import type { Enums } from "@/types/database"

const PLACE_OF_SUPPLY_OPTIONS = [
  { value: "", label: "None (overseas or not known)" },
  ...INDIAN_STATES.map((state) => ({ value: state.code, label: `[${state.short}] ${state.name}` })),
]

type QuotationFormProps = {
  options: QuotationFormOptions
  // Owners and admins can add TDS / TCS rates from the totals.
  canManageDirectTaxes: boolean
  defaultValues: QuotationInput
} & (
  | {
      mode: "create"
      // The number the quote gets if left as is (taken from the numbering when saved).
      suggestedQuoteNumber: string
    }
  | {
      mode: "edit"
      quotationId: string
      attachments: QuotationAttachmentView[]
      // Users who can view but not edit quotations see the form read-only.
      readOnly: boolean
    }
)

const num = (value: string) => Number(value || 0)

// Zoho-style New Quote: customer and quote details, the item table, notes and terms,
// and live totals (worked out the same way the server stores them).
export function QuotationForm(props: QuotationFormProps) {
  const { mode, options } = props
  const readOnly = mode === "edit" && props.readOnly
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [savingAs, setSavingAs] = useState<Enums<"quotation_status"> | "update">()
  const [error, setError] = useState<string>()
  const [savedFiles, setSavedFiles] = useState(mode === "edit" ? props.attachments : [])
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([])
  // TDS / TCS rates, with any added from this form. (The TDS / TCS row is hidden for now;
  // setDirectTaxes comes back with it.)
  const [directTaxes /* , setDirectTaxes */] = useState(options.directTaxes)
  const disabled = readOnly || isPending

  const form = useForm<QuotationInput>({
    resolver: zodResolver(quotationSchema),
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues: props.defaultValues,
  })
  const { control, setValue, getValues } = form

  const values = useWatch({ control })
  const customer = options.customers.find((entry) => entry.id === values.customerId)
  const isOverseas = customer?.gst_treatment === "Overseas"

  const totals = computeQuotationTotals({
    lines: (values.lines ?? []).map((line) => ({
      quantity: num(line?.quantity ?? ""),
      rate: num(line?.rate ?? ""),
      discountValue: num(line?.discountValue ?? ""),
      discountIsPercent: line?.discountIsPercent ?? true,
      taxId: line?.taxId || null,
    })),
    discountLevel: values.discountLevel ?? "Transaction",
    discountValue: num(values.discountValue ?? ""),
    discountIsPercent: values.discountIsPercent ?? true,
    isDiscountBeforeTax: values.isDiscountBeforeTax ?? true,
    adjustment: num(values.adjustment ?? ""),
    taxes: options.taxes,
    directTax: (() => {
      const rate = directTaxes.find((entry) => entry.id === values.directTaxId)
      return rate && rate.kind === values.taxDeductionType
        ? { kind: rate.kind, rate: rate.rate }
        : null
    })(),
  })

  // Lines from items follow the place of supply: CGST + SGST in the business's own
  // state, IGST elsewhere. Lines whose tax was changed by hand to something else stay.
  function retaxLines(placeOfSupply: string, overseas: boolean) {
    getValues("lines").forEach((line, index) => {
      if (!line.itemIntraTaxId && !line.itemInterTaxId) return
      const taxId = defaultTaxIdFor(
        { intraTaxId: line.itemIntraTaxId || null, interTaxId: line.itemInterTaxId || null },
        placeOfSupply || null,
        options.businessState,
        overseas
      )
      setValue(`lines.${index}.taxId`, taxId ?? "", { shouldDirty: true })
    })
  }

  // Picking a customer brings in their place of supply and price list.
  const previousCustomer = useRef(values.customerId)
  useEffect(() => {
    if (previousCustomer.current === values.customerId) return
    previousCustomer.current = values.customerId
    if (!customer) return
    const overseas = customer.gst_treatment === "Overseas"
    const placeOfSupply = overseas ? "" : (customer.place_of_supply ?? "")
    setValue("placeOfSupply", placeOfSupply, { shouldDirty: true })
    setValue("priceListId", customer.price_list_id ?? "", { shouldDirty: true })
    retaxLines(placeOfSupply, overseas)
    // retaxLines only reads current values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.customerId, customer])

  // Changing the place of supply by hand re-picks the line taxes too.
  const previousPlace = useRef(values.placeOfSupply)
  useEffect(() => {
    if (previousPlace.current === values.placeOfSupply) return
    previousPlace.current = values.placeOfSupply
    retaxLines(values.placeOfSupply ?? "", isOverseas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.placeOfSupply])

  function save(status: Enums<"quotation_status"> | null, label: typeof savingAs) {
    return form.handleSubmit((input) => {
      setError(undefined)
      setSavingAs(label)
      startTransition(async () => {
        // Left at the suggested number: the numbering assigns it when saving, so two
        // people saving at once still get different numbers.
        const quoteNumber =
          mode === "create" && input.quoteNumber.trim() === props.suggestedQuoteNumber
            ? ""
            : input.quoteNumber
        const result = await saveQuotation(
          mode === "edit" ? props.quotationId : null,
          { ...input, quoteNumber },
          status
        )
        if (!result.success) {
          setError(result.error)
          return
        }
        if (pendingFiles.length) {
          try {
            await uploadQuotationAttachments(result.data.id, pendingFiles)
            setPendingFiles([])
          } catch {
            toast.error("The quotation was saved, but its files couldn't be uploaded.")
          }
        }
        toast.success(
          mode === "edit"
            ? "Quotation updated."
            : status === "Sent"
              ? "Quotation saved and marked as sent."
              : "Quotation saved as draft."
        )
        // The opened quotation beside the list shows the saved version.
        invalidateQuotationDetail(result.data.id)
        router.push(quotationRoute(result.data.id))
        router.refresh()
      })
    }, scrollToFirstInvalid)
  }

  const customerOptions = options.customers
    .filter((entry) => entry.is_active || entry.id === values.customerId)
    .map((entry) => ({
      value: entry.id,
      label: entry.company_name && entry.company_name !== entry.display_name
        ? `${entry.display_name} (${entry.company_name})`
        : entry.display_name,
    }))
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
      <form
        onSubmit={save(mode === "edit" ? null : "Draft", mode === "edit" ? "update" : "Draft")}
        noValidate
        className="flex flex-col gap-6"
      >
        <FormError message={error} />
        {readOnly && (
          <Alert>
            <Info />
            <AlertDescription>You can view this quotation but not change it.</AlertDescription>
          </Alert>
        )}
        <fieldset disabled={disabled} className="contents">
          <Card className="gap-0 py-0">
            <FieldGroup className="max-w-3xl gap-4 p-6">
              <FormAutocompleteField
                control={control}
                name="customerId"
                label="Customer Name"
                orientation="horizontal"
                required
                placeholder="Type or click to select a customer"
                options={customerOptions}
                disabled={disabled}
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
                disabled={disabled}
              />
              {!options.businessState && (
                <div className={HORIZONTAL_FIELD_CLASS}>
                  <span aria-hidden="true" />
                  <p className="text-xs text-amber-700">
                    Your business&apos;s GST state isn&apos;t set, so items use CGST + SGST. An
                    owner or admin can set it in Settings → Taxes.
                  </p>
                </div>
              )}
              <FormInputField
                control={control}
                name="quoteNumber"
                label="Quote#"
                orientation="horizontal"
                hint="The next number in sequence. Type another to use your own; a higher QT number moves the numbering on. Left blank, the next number is used."
                placeholder="Next number when saved"
                autoComplete="off"
              />
              <FormInputField
                control={control}
                name="referenceNumber"
                label="Reference#"
                orientation="horizontal"
                autoComplete="off"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInputField
                  control={control}
                  name="quoteDate"
                  label="Quote Date"
                  orientation="horizontal"
                  required
                  type="date"
                />
                <FormInputField
                  control={control}
                  name="expiryDate"
                  label="Expiry Date"
                  orientation="horizontal"
                  type="date"
                />
              </div>
              <FormComboboxField
                control={control}
                name="salespersonId"
                label="Salesperson"
                orientation="horizontal"
                placeholder="Select a salesperson"
                searchPlaceholder="Search users"
                options={salespersonOptions}
                disabled={disabled}
              />
              <FormComboboxField
                control={control}
                name="priceListId"
                label="Price List"
                orientation="horizontal"
                hint="The price list every line starts with (taken from the customer). Changing it re-prices all items; each line can pick its own in the Discount column."
                placeholder="None (selling prices)"
                searchPlaceholder="Search price lists"
                options={priceListOptions}
                disabled={disabled}
              />
              <FormTextareaField
                control={control}
                name="subject"
                label="Subject"
                orientation="horizontal"
                placeholder="Let your customer know what this quote is for"
                rows={2}
              />
            </FieldGroup>

            {/* Like Zoho: discounts are per line (the Discount column, % or ₹). */}
            <section className="border-t p-6">
              <QuotationItemsTable
                taxes={options.taxes}
                priceLists={options.priceLists}
                lineAmounts={totals.lineAmounts}
                businessState={options.businessState}
                isOverseas={isOverseas}
                disabled={disabled}
                notes={
                  <FormTextareaField
                    control={control}
                    name="notes"
                    label="Customer Notes"
                    placeholder="Will be displayed on the quote"
                    rows={2}
                  />
                }
                totals={
                  <Totals
                    totals={totals}
                    disabled={disabled}
                    // TDS / TCS is hidden for now. To show it again, uncomment this (and
                    // the DirectTaxField import and setDirectTaxes above).
                    // directTax={
                    //   <DirectTaxField
                    //     rates={directTaxes}
                    //     amount={totals.directTaxAmount}
                    //     canManage={props.canManageDirectTaxes}
                    //     disabled={disabled}
                    //     onRateAdded={(rate) => setDirectTaxes((current) => [...current, rate])}
                    //   />
                    // }
                  />
                }
              />
            </section>

            <section className="grid gap-6 border-t bg-muted/40 p-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
              <FormTextareaField
                control={control}
                name="terms"
                label="Terms & Conditions"
                placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                rows={5}
              />
              <QuotationAttachmentsField
                existing={savedFiles}
                onExistingChange={setSavedFiles}
                pending={pendingFiles}
                onPendingChange={setPendingFiles}
                canRemove={mode === "edit" && !readOnly}
                disabled={disabled}
              />
            </section>
          </Card>
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={mode === "edit" ? quotationRoute(props.quotationId) : ROUTES.quotations}>
              {readOnly ? "Back" : "Cancel"}
            </Link>
          </Button>
          {!readOnly &&
            (mode === "edit" ? (
              <Button type="submit" disabled={isPending}>
                {isPending && <Spinner />}
                Update
              </Button>
            ) : (
              <>
                <Button type="submit" variant="outline" disabled={isPending}>
                  {isPending && savingAs === "Draft" && <Spinner />}
                  Save as Draft
                </Button>
                <Button type="button" disabled={isPending} onClick={save("Sent", "Sent")}>
                  {isPending && savingAs === "Sent" && <Spinner />}
                  Save and Mark as Sent
                </Button>
              </>
            ))}
        </div>
      </form>
    </FormProvider>
  )
}

// Like Zoho: sub total, the whole-quote discount, GST by rate, TDS / TCS, adjustment
// and total.
function Totals({
  totals,
  disabled,
  directTax,
}: {
  totals: ReturnType<typeof computeQuotationTotals>
  disabled: boolean
  // The TDS / TCS row (hidden for now).
  directTax?: React.ReactNode
}) {
  const { control, register, getFieldState, formState } = useFormContext<QuotationInput>()
  const adjustment = useWatch({ control, name: "adjustment" })
  const adjustmentError = getFieldState("adjustment", formState).error

  return (
    <div className="flex flex-col gap-3 self-start rounded-xl bg-muted/40 p-4 text-sm">
      <Row label="Sub Total" value={formatCurrency(totals.subTotal)} strong />

      {/* Only older quotations with a whole-quote discount have one. */}
      {totals.transactionDiscount > 0 && (
        <Row label="Discount" value={`−${formatCurrency(totals.transactionDiscount)}`} />
      )}

      {totals.taxBreakdown.map((line) => (
        <Row key={line.label} label={line.label} value={formatCurrency(line.amount)} muted />
      ))}

      {directTax}

      <div className="flex items-center justify-between gap-3">
        <Input
          {...register("adjustmentDescription")}
          placeholder="Adjustment"
          aria-label="Adjustment label"
          disabled={disabled}
          className="h-8 w-28 border-dashed bg-background"
        />
        <Input
          {...register("adjustment")}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Adjustment amount"
          aria-invalid={Boolean(adjustmentError)}
          disabled={disabled}
          className="h-8 w-28 bg-background text-right tabular-nums"
        />
        <FieldHint label="Adjustment" hint="Add any other +ve or -ve charges that need to be applied to adjust the total amount of the transaction, e.g. +10 or -10." />
        <span className="ml-auto w-24 text-right tabular-nums">
          {formatCurrency(Number(adjustment) || 0)}
        </span>
      </div>
      {adjustmentError && <FieldError errors={[adjustmentError]} />}

      <Separator />
      <Row label="Total ( ₹ )" value={formatCurrency(totals.total)} strong />
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string
  value: string
  muted?: boolean
  strong?: boolean
}) {
  return (
    <div
      className={
        strong
          ? "flex justify-between gap-3 text-base font-semibold"
          : muted
            ? "flex justify-between gap-3 text-muted-foreground"
            : "flex justify-between gap-3"
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export function QuotationFormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="gap-0 py-0">
        <div className="flex max-w-3xl flex-col gap-4 p-6">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t p-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid gap-8 border-t p-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-44" />
      </div>
    </div>
  )
}
