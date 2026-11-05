"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Info } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { savePriceList } from "@/actions/price-lists"
import { FormError } from "@/components/shared/form-error"
import { FormFieldLabel } from "@/components/shared/form-field-label"
import { FormInputField } from "@/components/shared/form-input-field"
import { FormSelectField, toSelectOptions } from "@/components/shared/form-select-field"
import { FormTextareaField } from "@/components/shared/form-textarea-field"
import { SubmitButton } from "@/components/shared/submit-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  DECIMAL_PLACES,
  PERCENTAGE_TYPES,
  PRICE_LIST_TYPE_DESCRIPTIONS,
  PRICE_LIST_TYPES,
  ROUND_OFF_LABELS,
  ROUND_OFF_TYPES,
  TRANSACTION_TYPES,
} from "@/constants/price-lists"
import { ROUTES } from "@/constants/routes"
import { PriceListItemsField } from "@/features/price-lists/components/price-list-items-field"
import type { PriceListItemOption } from "@/features/price-lists/queries"
import { formatCurrency } from "@/lib/format"
import { applyPriceAdjustment } from "@/lib/price-lists"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import { priceListSchema, type PriceListInput } from "@/lib/validations/price-list"

const PREVIEW_RATE = 1000

const NEW_PRICE_LIST: PriceListInput = {
  name: "",
  transactionType: "Sales",
  priceListType: "All Items",
  description: "",
  percentageType: "Markup",
  percentageValue: "",
  roundOffTo: "Never mind",
  decimalPlaces: "2",
  itemRates: {},
  isActive: true,
}

type PriceListFormProps = {
  items: PriceListItemOption[]
} & (
  | { mode: "create" }
  | {
      mode: "edit"
      priceListId: string
      defaultValues: PriceListInput
      // Users who can view but not edit price lists see the form read-only.
      readOnly: boolean
    }
)

export function PriceListForm(props: PriceListFormProps) {
  const { mode } = props
  const readOnly = mode === "edit" && props.readOnly
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const disabled = readOnly || isPending

  const form = useForm<PriceListInput>({
    resolver: zodResolver(priceListSchema),
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues: mode === "edit" ? props.defaultValues : NEW_PRICE_LIST,
  })
  const [priceListType, transactionType, percentageType, percentageValue, roundOffTo, decimalPlaces] =
    useWatch({
      control: form.control,
      name: [
        "priceListType",
        "transactionType",
        "percentageType",
        "percentageValue",
        "roundOffTo",
        "decimalPlaces",
      ],
    })

  const previewPercentage = Number(percentageValue)
  const preview =
    percentageValue && Number.isFinite(previewPercentage)
      ? applyPriceAdjustment(PREVIEW_RATE, {
          percentageType,
          percentageValue: previewPercentage,
          roundOffTo,
          decimalPlaces: Number(decimalPlaces),
        })
      : null

  function onSubmit(values: PriceListInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await savePriceList(mode === "edit" ? props.priceListId : null, values)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(mode === "create" ? "Price list created." : "Price list updated.")
      router.push(ROUTES.priceLists)
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit, scrollToFirstInvalid)} noValidate className="flex flex-col gap-6">
      <FormError message={error} />
      {readOnly && (
        <Alert>
          <Info />
          <AlertDescription>You can view this price list but not change it.</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={disabled} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Price list details</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormInputField
                  control={form.control}
                  name="name"
                  label="Name"
                  required
                  autoComplete="off"
                />
                <Controller
                  control={form.control}
                  name="transactionType"
                  render={({ field }) => (
                    <Field>
                      <FormFieldLabel label="Transaction type" required />
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={disabled}
                        className="flex h-8 items-center gap-6"
                      >
                        {TRANSACTION_TYPES.map((type) => (
                          <Field key={type} orientation="horizontal" className="w-auto">
                            <RadioGroupItem value={type} id={`transaction-${type}`} />
                            <FieldLabel htmlFor={`transaction-${type}`} className="font-normal">
                              {type}
                            </FieldLabel>
                          </Field>
                        ))}
                      </RadioGroup>
                    </Field>
                  )}
                />
              </div>
              <Controller
                control={form.control}
                name="priceListType"
                render={({ field }) => (
                  <Field>
                    <FormFieldLabel label="Price list type" required />
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={disabled}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {PRICE_LIST_TYPES.map((type) => (
                        <FieldLabel
                          key={type}
                          htmlFor={`type-${type}`}
                          className="rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                        >
                          <Field orientation="horizontal">
                            <RadioGroupItem value={type} id={`type-${type}`} />
                            <FieldContent>
                              <span className="font-medium">{type}</span>
                              <FieldDescription>{PRICE_LIST_TYPE_DESCRIPTIONS[type]}</FieldDescription>
                            </FieldContent>
                          </Field>
                        </FieldLabel>
                      ))}
                    </RadioGroup>
                  </Field>
                )}
              />
              <FormTextareaField
                control={form.control}
                name="description"
                label="Description"
                rows={2}
                maxLength={500}
              />
              {mode === "edit" && (
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <Switch
                        id="isActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={disabled}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="isActive">Active</FieldLabel>
                        <FieldDescription>
                          Inactive price lists can&apos;t be used on new transactions.
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  )}
                />
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        {priceListType === "All Items" ? (
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>
                Applied to each item&apos;s {transactionType === "Sales" ? "selling" : "cost"} price.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 sm:grid-cols-2">
                <FormSelectField
                  control={form.control}
                  name="percentageType"
                  required
                  label="Markup or markdown"
                  options={toSelectOptions(PERCENTAGE_TYPES)}
                  disabled={disabled}
                />
                <FormInputField
                  control={form.control}
                  name="percentageValue"
                  required
                  label="Percentage"
                  endAddon="%"
                  inputMode="decimal"
                  placeholder="10"
                />
                <FormSelectField
                  control={form.control}
                  name="roundOffTo"
                  label="Round off to"
                  options={ROUND_OFF_TYPES.map((type) => ({
                    value: type,
                    label: ROUND_OFF_LABELS[type],
                  }))}
                  disabled={disabled}
                />
                {roundOffTo === "Decimal Places" && (
                  <FormSelectField
                    control={form.control}
                    name="decimalPlaces"
                    label="Decimal places"
                    options={toSelectOptions(DECIMAL_PLACES)}
                    disabled={disabled}
                  />
                )}
                <p className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground sm:col-span-2">
                  {preview === null ? (
                    "Enter a percentage to see an example."
                  ) : (
                    <>
                      Example: an item priced{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(PREVIEW_RATE)}
                      </span>{" "}
                      becomes{" "}
                      <span className="font-medium text-foreground">{formatCurrency(preview)}</span>
                      .
                    </>
                  )}
                </p>
              </FieldGroup>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Item rates</CardTitle>
              <CardDescription>
                Leave a custom rate empty to keep the item&apos;s normal rate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                control={form.control}
                name="itemRates"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <PriceListItemsField
                      items={props.items}
                      transactionType={transactionType}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={disabled}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </CardContent>
          </Card>
        )}
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={ROUTES.priceLists}>{readOnly ? "Back" : "Cancel"}</Link>
        </Button>
        {!readOnly && (
          <SubmitButton pending={isPending}>
            {mode === "create" ? "Save price list" : "Update"}
          </SubmitButton>
        )}
      </div>
    </form>
  )
}

export function PriceListFormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      {[4, 3].map((fields, card) => (
        <Card key={card}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: fields }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
