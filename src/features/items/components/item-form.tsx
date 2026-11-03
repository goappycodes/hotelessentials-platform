"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Info, Pencil } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { saveItem } from "@/actions/items"
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
import { SubmitButton } from "@/components/shared/submit-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ITEM_TYPES,
  ITEM_UNITS,
  PURCHASE_ACCOUNTS,
  SALES_ACCOUNTS,
  TAX_PREFERENCES,
} from "@/constants/items"
import { ROUTES, itemRoute } from "@/constants/routes"
import { HsnCodeField, type HsnCode } from "@/features/items/components/hsn-code-field"
import {
  ItemImagesField,
  uploadItemImages,
  type PendingImage,
} from "@/features/items/components/item-images-field"
import type { ItemImageView } from "@/features/items/queries"
import { formatTaxName, type TaxRate } from "@/features/taxes/tax-rates"
import { itemSchema, type ItemInput } from "@/lib/validations/item"

export const NEW_ITEM: ItemInput = {
  type: "Goods",
  name: "",
  sku: "",
  unit: "",
  hsnCodeId: "",
  taxPreference: "Taxable",
  salesEnabled: true,
  sellingPrice: "",
  salesAccount: "Sales",
  salesDescription: "",
  purchaseEnabled: true,
  costPrice: "",
  purchaseAccount: "Cost of Goods Sold",
  purchaseDescription: "",
  preferredVendor: "",
  intraStateTaxId: "",
  interStateTaxId: "",
  trackInventory: false,
  isActive: true,
}

type ItemFormProps = {
  hsnCodes: HsnCode[]
  taxRates: TaxRate[]
} & (
  // defaultValues: a copy of another item when cloning.
  | { mode: "create"; defaultValues?: ItemInput }
  | {
      mode: "edit"
      itemId: string
      defaultValues: ItemInput
      images: ItemImageView[]
      // Users who can view but not edit items, or a locked item: read-only.
      readOnly: boolean
      isLocked: boolean
    }
)

export function ItemForm(props: ItemFormProps) {
  const { mode } = props
  const readOnly = mode === "edit" && props.readOnly
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [hsnCodes, setHsnCodes] = useState(props.hsnCodes)
  const [savedImages, setSavedImages] = useState(mode === "edit" ? props.images : [])
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  // Default taxes show as text with a pencil, like Zoho; the pickers open on demand.
  const [isEditingTaxes, setIsEditingTaxes] = useState(false)

  const form = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues:
      mode === "edit"
        ? props.defaultValues
        : props.defaultValues ?? {
            ...NEW_ITEM,
            intraStateTaxId: getDefaultTaxId(props.taxRates, "Intra-state"),
            interStateTaxId: getDefaultTaxId(props.taxRates, "Inter-state"),
          },
  })
  const [salesEnabled, purchaseEnabled, taxPreference, intraStateTaxId, interStateTaxId, unit] =
    useWatch({
      control: form.control,
      name: [
        "salesEnabled",
        "purchaseEnabled",
        "taxPreference",
        "intraStateTaxId",
        "interStateTaxId",
        "unit",
      ],
    })
  // Common units, plus a custom one the user typed.
  const unitOptions = toSelectOptions(
    unit && !ITEM_UNITS.includes(unit) ? [...ITEM_UNITS, unit] : ITEM_UNITS
  )

  const taxErrors = form.formState.errors.intraStateTaxId || form.formState.errors.interStateTaxId
  const showTaxPickers =
    isEditingTaxes || Boolean(taxErrors) || !intraStateTaxId || !interStateTaxId

  function findTax(id: string) {
    return props.taxRates.find((tax) => tax.id === id)
  }

  // Inactive taxes stay listed only for items that already use them.
  function taxOptions(scope: TaxRate["tax_scope"], selectedId: string) {
    return props.taxRates
      .filter((tax) => tax.tax_scope === scope && (tax.is_active || tax.id === selectedId))
      .map((tax) => ({ value: tax.id, label: formatTaxName(tax) }))
  }

  function onSubmit(values: ItemInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await saveItem(mode === "edit" ? props.itemId : null, values)
      if (!result.success) {
        setError(result.error)
        return
      }

      if (pendingImages.length) {
        try {
          await uploadItemImages(result.data.id, pendingImages)
        } catch {
          toast.error("The item was saved, but its images couldn't be uploaded.")
          router.push(itemRoute(result.data.id))
          return
        }
      }

      toast.success(mode === "create" ? "Item created." : "Item updated.")
      router.push(itemRoute(result.data.id))
    })
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <FormError message={error} />
        {readOnly && (
          <Alert>
            <Info />
            <AlertDescription>
              {mode === "edit" && props.isLocked
                ? "This item is locked. An owner or admin can unlock it from the More menu."
                : "You can view this item but not change it."}
            </AlertDescription>
          </Alert>
        )}
        <fieldset disabled={readOnly || isPending} className="contents">
          <Card className="gap-0 py-0">
            <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,34rem)_14rem] lg:justify-between">
              {/* Zoho-style rows: label on the left, field on the right. */}
              <FieldGroup className="gap-4">
                <FormInputField
                  control={form.control}
                  name="name"
                  label="Name"
                  orientation="horizontal"
                  required
                  autoComplete="off"
                  autoFocus={mode === "create"}
                />
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Field className={HORIZONTAL_FIELD_CLASS}>
                      <FormFieldLabel
                        label="Type"
                        hint="Goods are physical products you sell or buy; services are work you provide, like installation."
                      />
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={readOnly || isPending}
                        aria-label="Type"
                        className="flex h-8 items-center gap-6"
                      >
                        {ITEM_TYPES.map((type) => (
                          <Field key={type} orientation="horizontal" className="w-auto">
                            <RadioGroupItem value={type} id={`type-${type}`} />
                            <FieldLabel htmlFor={`type-${type}`} className="font-normal">
                              {type}
                            </FieldLabel>
                          </Field>
                        ))}
                      </RadioGroup>
                    </Field>
                  )}
                />
                <div className="max-w-[28rem]">
                  <FormComboboxField
                    control={form.control}
                    name="unit"
                    label="Unit"
                    orientation="horizontal"
                    hint="How the item is counted or sold, e.g. pcs, box or kg. Pick one or type your own."
                    placeholder="Select or type a unit"
                    searchPlaceholder="Search or type a unit"
                    options={unitOptions}
                    onCreate={(unit) =>
                      form.setValue("unit", unit.slice(0, 20), { shouldDirty: true, shouldValidate: true })
                    }
                    createLabel={(unit) => `Use “${unit}”`}
                    disabled={readOnly || isPending}
                  />
                </div>
                <div className="max-w-[28rem]">
                  <FormInputField
                    control={form.control}
                    name="sku"
                    label="SKU"
                    orientation="horizontal"
                    hint="Stock Keeping Unit: your own unique code for this item."
                    autoComplete="off"
                  />
                </div>
                <div className="max-w-[28rem]">
                  <HsnCodeField
                    hsnCodes={hsnCodes}
                    disabled={readOnly || isPending}
                    onCreated={(hsnCode) =>
                      setHsnCodes((codes) =>
                        [...codes, hsnCode].sort((a, b) => a.code.localeCompare(b.code))
                      )
                    }
                  />
                </div>
                <div className="max-w-[28rem]">
                  <FormSelectField
                    control={form.control}
                    name="taxPreference"
                    label="Tax Preference"
                    orientation="horizontal"
                    required
                    options={toSelectOptions(TAX_PREFERENCES)}
                    disabled={readOnly || isPending}
                  />
                </div>
              </FieldGroup>
              <ItemImagesField
                existing={savedImages}
                onExistingChange={setSavedImages}
                pending={pendingImages}
                onPendingChange={setPendingImages}
                disabled={readOnly || isPending}
              />
            </div>

          <FormSection>
            <SectionCheckbox name="salesEnabled" label="Sales Information" disabled={readOnly || isPending} />
            <fieldset disabled={!salesEnabled} className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
              <FormInputField
                control={form.control}
                name="sellingPrice"
                label="Selling Price"
                orientation="horizontal"
                required={salesEnabled}
                startAddon="INR"
                inputMode="decimal"
              />
              <FormSelectField
                control={form.control}
                name="salesAccount"
                label="Account"
                orientation="horizontal"
                required={salesEnabled}
                options={toSelectOptions(SALES_ACCOUNTS)}
                disabled={readOnly || isPending || !salesEnabled}
              />
              <FormTextareaField
                control={form.control}
                name="salesDescription"
                label="Description"
                orientation="horizontal"
                rows={2}
              />
            </fieldset>
          </FormSection>

          <FormSection>
            <SectionCheckbox
              name="purchaseEnabled"
              label="Purchase Information"
              disabled={readOnly || isPending}
            />
            <fieldset disabled={!purchaseEnabled} className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
              <FormInputField
                control={form.control}
                name="costPrice"
                label="Cost Price"
                orientation="horizontal"
                required={purchaseEnabled}
                startAddon="INR"
                inputMode="decimal"
              />
              <FormSelectField
                control={form.control}
                name="purchaseAccount"
                label="Account"
                orientation="horizontal"
                required={purchaseEnabled}
                options={toSelectOptions(PURCHASE_ACCOUNTS)}
                disabled={readOnly || isPending || !purchaseEnabled}
              />
              <FormTextareaField
                control={form.control}
                name="purchaseDescription"
                label="Description"
                orientation="horizontal"
                rows={2}
              />
              <FormInputField
                control={form.control}
                name="preferredVendor"
                label="Preferred Vendor"
                orientation="horizontal"
                autoComplete="off"
              />
            </fieldset>
          </FormSection>

          <FormSection>
            <div className="flex items-center gap-1">
              <h3 className="font-medium">Default Tax Rates</h3>
              {taxPreference === "Taxable" && !showTaxPickers && !readOnly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Change default tax rates"
                      onClick={() => setIsEditingTaxes(true)}
                    >
                      <Pencil />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Change default tax rates</TooltipContent>
                </Tooltip>
              )}
            </div>
            {taxPreference !== "Taxable" ? (
              <p className="text-sm text-muted-foreground">
                No GST rates apply to {taxPreference.toLowerCase()} items.
              </p>
            ) : showTaxPickers ? (
              <div className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
                <FormComboboxField
                  control={form.control}
                  name="intraStateTaxId"
                  label="Intra State Tax Rate"
                  orientation="horizontal"
                  required
                  hint="For sales within your state: CGST + SGST."
                  groupLabel="Tax Group"
                  placeholder="Select a tax"
                  options={taxOptions("Intra-state", intraStateTaxId)}
                  disabled={readOnly || isPending}
                />
                <FormComboboxField
                  control={form.control}
                  name="interStateTaxId"
                  label="Inter State Tax Rate"
                  orientation="horizontal"
                  required
                  hint="For sales to other states: IGST."
                  groupLabel="Tax"
                  placeholder="Select a tax"
                  options={taxOptions("Inter-state", interStateTaxId)}
                  disabled={readOnly || isPending}
                />
              </div>
            ) : (
              <dl className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
                <TaxSummary label="Intra State Tax Rate" tax={findTax(intraStateTaxId)} />
                <TaxSummary label="Inter State Tax Rate" tax={findTax(interStateTaxId)} />
              </dl>
            )}
          </FormSection>

          <FormSection>
            <SectionCheckbox
              name="trackInventory"
              label="Track Inventory for this item"
              hint="Keep a running count of stock for this item."
              description="Stock levels update as you record sales and purchases of this item."
              disabled={readOnly || isPending}
            />
          </FormSection>

          {mode === "edit" && (
            <FormSection>
              <SectionCheckbox
                name="isActive"
                label="Active"
                description="Inactive items can't be added to new transactions."
                disabled={readOnly || isPending}
              />
            </FormSection>
          )}
        </Card>
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={mode === "edit" ? itemRoute(props.itemId) : ROUTES.items}>
              {readOnly ? "Back" : "Cancel"}
            </Link>
          </Button>
          {!readOnly && (
            <SubmitButton pending={isPending}>
              {mode === "create" ? "Save item" : "Update"}
            </SubmitButton>
          )}
        </div>
      </form>
    </FormProvider>
  )
}

// New items start on the 18% slab when it exists, otherwise the first active tax.
function getDefaultTaxId(taxRates: TaxRate[], scope: TaxRate["tax_scope"]) {
  const active = taxRates.filter((tax) => tax.tax_scope === scope && tax.is_active)
  return (active.find((tax) => tax.rate === 18) ?? active[0])?.id ?? ""
}

// One section of the item panel, separated from the one above by a line.
function FormSection({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col gap-4 border-t p-6">{children}</section>
}

// A section heading that switches the section on or off, e.g. "Sales Information".
function SectionCheckbox({
  name,
  label,
  hint,
  description,
  disabled,
}: {
  name: "salesEnabled" | "purchaseEnabled" | "trackInventory" | "isActive"
  label: string
  hint?: string
  description?: string
  disabled: boolean
}) {
  return (
    <Controller
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Checkbox
            id={name}
            checked={field.value}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            disabled={disabled}
          />
          <FieldContent>
            <div className="flex items-center gap-1">
              <FieldLabel htmlFor={name} className="text-base font-medium">
                {label}
              </FieldLabel>
              {hint && <FieldHint label={label} hint={hint} />}
            </div>
            {description && <FieldDescription>{description}</FieldDescription>}
          </FieldContent>
        </Field>
      )}
    />
  )
}

function TaxSummary({ label, tax }: { label: string; tax: TaxRate | undefined }) {
  return (
    <div className={HORIZONTAL_FIELD_CLASS}>
      <dt className="text-sm">{label}</dt>
      <dd className="text-sm">{tax ? formatTaxName(tax) : "Not set"}</dd>
    </div>
  )
}

export function ItemFormSkeleton() {
  return (
    <Card aria-busy="true" className="gap-0 py-0">
      <span className="sr-only">Loading…</span>
      {[6, 3, 4, 2].map((fields, section) => (
        <div key={section} className="flex flex-col gap-4 border-t p-6 first:border-t-0">
          {section > 0 && <Skeleton className="h-5 w-40" />}
          <div className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
            {Array.from({ length: fields }, (_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Card>
  )
}
