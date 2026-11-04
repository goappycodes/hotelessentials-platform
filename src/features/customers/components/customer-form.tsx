"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Info, Plus, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, useTransition } from "react"
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type FieldPath,
} from "react-hook-form"
import { toast } from "sonner"

import { saveCustomer } from "@/actions/customers"
import { FormComboboxField } from "@/components/shared/form-combobox-field"
import { FormError } from "@/components/shared/form-error"
import { FormFieldLabel, HORIZONTAL_FIELD_CLASS } from "@/components/shared/form-field-label"
import { FormInputField } from "@/components/shared/form-input-field"
import { FormSelectField, toSelectOptions } from "@/components/shared/form-select-field"
import { FormTextareaField } from "@/components/shared/form-textarea-field"
import { PhoneInput } from "@/components/shared/phone-input"
import { SubmitButton } from "@/components/shared/submit-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CUSTOMER_LANGUAGES,
  CUSTOMER_TYPES,
  DEFAULT_COUNTRY,
  GST_TREATMENT_DESCRIPTIONS,
  GST_TREATMENTS,
  GST_TREATMENTS_WITHOUT_GSTIN,
  INDIAN_STATES,
  PAYMENT_TERMS,
  SALUTATIONS,
} from "@/constants/customers"
import { COUNTRIES } from "@/constants/countries"
import { ROUTES, customerRoute } from "@/constants/routes"
import { EMPTY_CONTACT } from "@/features/customers/customer-input"
import type { CustomerFormOptions } from "@/features/customers/queries"
import {
  customerSchema,
  GSTIN_PATTERN,
  type CustomerInput,
} from "@/lib/validations/customer"
import { cn } from "@/lib/utils"

// Radix Select can't hold an empty value, so "none" stands in for "nothing picked".
const NONE = "__none__"

const STATE_OPTIONS = INDIAN_STATES.map((state) => ({ value: state.name, label: state.name }))
// Both optional, so each list starts with "None" to clear the choice.
const PLACE_OF_SUPPLY_OPTIONS = [
  { value: "", label: "None" },
  ...INDIAN_STATES.map((state) => ({ value: state.code, label: `[${state.short}] ${state.name}` })),
]
const GST_TREATMENT_OPTIONS = [{ value: "", label: "None" }, ...toSelectOptions(GST_TREATMENTS)]

type CustomerFormProps = {
  options: CustomerFormOptions
  defaultValues: CustomerInput
} & (
  | { mode: "create" }
  | {
      mode: "edit"
      customerId: string
      // Users who can view but not edit customers see the form read-only.
      readOnly: boolean
    }
)

// Zoho-style New Customer form: details on top, then Other Details, Address, Contact
// Persons and Remarks tabs.
export function CustomerForm(props: CustomerFormProps) {
  const { mode, options } = props
  const readOnly = mode === "edit" && props.readOnly
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState("other")
  const disabled = readOnly || isPending

  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: props.defaultValues,
  })

  function onSubmit(values: CustomerInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await saveCustomer(mode === "edit" ? props.customerId : null, values)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(mode === "create" ? "Customer created." : "Customer updated.")
      router.push(mode === "create" ? ROUTES.customers : customerRoute(result.data.id))
      router.refresh()
    })
  }

  // Errors in a tab that isn't showing: open the first such tab so they can be seen.
  function onInvalid(errors: Partial<Record<keyof CustomerInput, unknown>>) {
    const otherFields: (keyof CustomerInput)[] = [
      "gstTreatment",
      "gstin",
      "placeOfSupply",
      "pan",
      "exemptionReason",
      "openingBalance",
    ]
    if (otherFields.some((field) => errors[field])) setTab("other")
    else if (errors.billing || errors.shipping) setTab("address")
    else if (errors.contacts) setTab("contacts")
    else if (errors.remarks) setTab("remarks")
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="flex flex-col gap-6"
      >
        <FormError message={error} />
        {readOnly && (
          <Alert>
            <Info />
            <AlertDescription>You can view this customer but not change it.</AlertDescription>
          </Alert>
        )}
        <fieldset disabled={disabled} className="contents">
          <Card className="gap-0 py-0">
            <CustomerDetails disabled={disabled} />

            <Tabs value={tab} onValueChange={setTab} className="gap-0 border-t">
              <TabsList variant="line" className="h-auto w-full justify-start gap-6 border-b px-6">
                <TabsTrigger value="other" className="flex-none px-0 py-2.5">
                  Other Details
                </TabsTrigger>
                <TabsTrigger value="address" className="flex-none px-0 py-2.5">
                  Address
                </TabsTrigger>
                <TabsTrigger value="contacts" className="flex-none px-0 py-2.5">
                  Contact Persons
                </TabsTrigger>
                <TabsTrigger value="remarks" className="flex-none px-0 py-2.5">
                  Remarks
                </TabsTrigger>
              </TabsList>
              {/* Kept mounted (forceMount + hidden), so every tab's fields stay registered. */}
              <TabsContent value="other" forceMount hidden={tab !== "other"} className="p-6">
                <OtherDetails options={options} disabled={disabled} />
              </TabsContent>
              <TabsContent value="address" forceMount hidden={tab !== "address"} className="p-6">
                <Addresses disabled={disabled} />
              </TabsContent>
              <TabsContent value="contacts" forceMount hidden={tab !== "contacts"} className="p-6">
                <ContactPersons disabled={disabled} />
              </TabsContent>
              <TabsContent value="remarks" forceMount hidden={tab !== "remarks"} className="p-6">
                <div className="max-w-2xl">
                  <FormTextareaField
                    control={form.control}
                    name="remarks"
                    label="Remarks"
                    description="For internal use only."
                    rows={4}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {mode === "edit" && (
              <section className="border-t p-6">
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <Checkbox
                        id="isActive"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        disabled={disabled}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="isActive" className="text-base font-medium">
                          Active
                        </FieldLabel>
                        <FieldDescription>
                          Inactive customers can&apos;t be picked on new transactions.
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  )}
                />
              </section>
            )}
          </Card>
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={ROUTES.customers}>{readOnly ? "Back" : "Cancel"}</Link>
          </Button>
          {!readOnly && (
            <SubmitButton pending={isPending}>{mode === "create" ? "Save" : "Update"}</SubmitButton>
          )}
        </div>
      </form>
    </FormProvider>
  )
}

// Customer type, primary contact, names, email, phones and language.
function CustomerDetails({ disabled }: { disabled: boolean }) {
  const { control, setValue, getValues } = useFormContext<CustomerInput>()
  const [salutation, firstName, lastName, companyName, displayName] = useWatch({
    control,
    name: ["salutation", "firstName", "lastName", "companyName", "displayName"],
  })

  // The display name follows the company name by default: while it's empty or still the
  // company name, typing a company name fills it in. Once changed, it's left alone.
  const followedCompanyName = useRef(companyName)
  useEffect(() => {
    const previous = followedCompanyName.current
    followedCompanyName.current = companyName
    if (previous === companyName) return
    const current = getValues("displayName")
    if (current === "" || current === previous) {
      setValue("displayName", companyName.slice(0, 200), { shouldDirty: true })
    }
  }, [companyName, getValues, setValue])

  // Zoho suggests display names built from the contact's name and the company.
  const fullName = [firstName, lastName].filter(Boolean).join(" ")
  const suggestions = [
    ...new Set(
      [
        salutation && fullName ? `${salutation} ${fullName}` : "",
        fullName,
        lastName && firstName ? `${lastName}, ${firstName}` : "",
        companyName,
        displayName,
      ].filter(Boolean)
    ),
  ]

  return (
    <FieldGroup className="max-w-3xl gap-4 p-6">
      <Controller
        control={control}
        name="customerType"
        render={({ field }) => (
          <Field className={HORIZONTAL_FIELD_CLASS}>
            <FormFieldLabel
              label="Customer Type"
              hint="Business customers usually have a company name and GSTIN; individuals are people buying for themselves."
            />
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              aria-label="Customer Type"
              className="flex h-8 items-center gap-6"
            >
              {CUSTOMER_TYPES.map((type) => (
                <Field key={type} orientation="horizontal" className="w-auto">
                  <RadioGroupItem value={type} id={`customer-type-${type}`} />
                  <FieldLabel htmlFor={`customer-type-${type}`} className="font-normal">
                    {type}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
          </Field>
        )}
      />

      <Field className={HORIZONTAL_FIELD_CLASS}>
        <FormFieldLabel
          htmlFor="firstName"
          label="Primary Contact"
          hint="The main person you deal with at this customer."
        />
        <div className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr]">
          <OptionalSelect
            name="salutation"
            label="Salutation"
            placeholder="Salutation"
            options={toSelectOptions(SALUTATIONS)}
            disabled={disabled}
          />
          <RegisteredInput name="firstName" label="First Name" placeholder="First Name" />
          <RegisteredInput name="lastName" label="Last Name" placeholder="Last Name" />
        </div>
      </Field>

      <FormInputField
        control={control}
        name="companyName"
        label="Company Name"
        orientation="horizontal"
        autoComplete="off"
      />
      <DisplayNameField suggestions={suggestions} disabled={disabled} />
      <FormInputField
        control={control}
        name="email"
        label="Email Address"
        orientation="horizontal"
        type="email"
        autoComplete="off"
      />
      <Field className={HORIZONTAL_FIELD_CLASS}>
        <FormFieldLabel htmlFor="workPhone" label="Phone" />
        <div className="grid gap-2 sm:grid-cols-2">
          <PhoneField name="workPhone" label="Work Phone" disabled={disabled} />
          <PhoneField name="mobile" label="Mobile" disabled={disabled} />
        </div>
      </Field>
      <div className="max-w-[28rem]">
        <FormSelectField
          control={control}
          name="language"
          label="Customer Language"
          orientation="horizontal"
          options={toSelectOptions(CUSTOMER_LANGUAGES)}
          disabled={disabled}
        />
      </div>
    </FieldGroup>
  )
}

// GST, tax, opening balance, payment terms, price list and owner.
function OtherDetails({ options, disabled }: { options: CustomerFormOptions; disabled: boolean }) {
  const { control, setValue, getValues } = useFormContext<CustomerInput>()
  const [gstTreatment, taxPreference, ownerId, priceListId] = useWatch({
    control,
    name: ["gstTreatment", "taxPreference", "ownerId", "priceListId"],
  })
  const needsGstin =
    gstTreatment !== "" && !GST_TREATMENTS_WITHOUT_GSTIN.includes(gstTreatment)

  // A GSTIN holds the state code (first 2) and the PAN (characters 3–12): fill them in.
  function onGstinChange(value: string) {
    const gstin = value.trim().toUpperCase()
    if (!GSTIN_PATTERN.test(gstin)) return
    if (INDIAN_STATES.some((state) => state.code === gstin.slice(0, 2))) {
      setValue("placeOfSupply", gstin.slice(0, 2), { shouldDirty: true, shouldValidate: true })
    }
    if (!getValues("pan")) {
      setValue("pan", gstin.slice(2, 12), { shouldDirty: true, shouldValidate: true })
    }
  }

  const priceListOptions = [
    { value: "", label: "None" },
    ...options.priceLists
      .filter((list) => list.is_active || list.id === priceListId)
      .map((list) => ({ value: list.id, label: list.name })),
  ]
  const ownerOptions = options.owners
    .filter((owner) => owner.isActive || owner.id === ownerId)
    .map((owner) => ({ value: owner.id, label: owner.name || "Unnamed user" }))

  return (
    <FieldGroup className="max-w-2xl gap-4">
      {/* Optional: imported customers often have no GST treatment. */}
      <FormComboboxField
        control={control}
        name="gstTreatment"
        label="GST Treatment"
        orientation="horizontal"
        placeholder="Select a GST treatment"
        searchPlaceholder="Search GST treatments"
        description={gstTreatment ? GST_TREATMENT_DESCRIPTIONS[gstTreatment] : undefined}
        options={GST_TREATMENT_OPTIONS}
        disabled={disabled}
      />
      {needsGstin && (
        <Controller
          control={control}
          name="gstin"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className={HORIZONTAL_FIELD_CLASS}>
              <FormFieldLabel
                htmlFor="gstin"
                label="GSTIN"
                required
                hint="15-character GST Identification Number. The place of supply and PAN are filled in from it."
              />
              <Input
                {...field}
                id="gstin"
                maxLength={15}
                autoComplete="off"
                className="uppercase"
                aria-invalid={fieldState.invalid}
                onChange={(event) => {
                  field.onChange(event.target.value.toUpperCase())
                  onGstinChange(event.target.value)
                }}
              />
              {fieldState.error && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      )}
      {gstTreatment !== "Overseas" && (
        <FormComboboxField
          control={control}
          name="placeOfSupply"
          label="Place of Supply"
          orientation="horizontal"
          hint="The customer's state. Same state as yours: CGST + SGST; another state: IGST."
          placeholder="Select a state"
          searchPlaceholder="Search states"
          options={PLACE_OF_SUPPLY_OPTIONS}
          disabled={disabled}
        />
      )}
      <Controller
        control={control}
        name="pan"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className={HORIZONTAL_FIELD_CLASS}>
            <FormFieldLabel htmlFor="pan" label="PAN" hint="Permanent Account Number, e.g. AABCU9603R." />
            <Input
              {...field}
              id="pan"
              maxLength={10}
              autoComplete="off"
              className="uppercase"
              aria-invalid={fieldState.invalid}
              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
            />
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        control={control}
        name="taxPreference"
        render={({ field }) => (
          <Field className={HORIZONTAL_FIELD_CLASS}>
            <FormFieldLabel label="Tax Preference" required />
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              aria-label="Tax Preference"
              className="flex h-8 items-center gap-6"
            >
              {(["Taxable", "Tax Exempt"] as const).map((preference) => (
                <Field key={preference} orientation="horizontal" className="w-auto">
                  <RadioGroupItem value={preference} id={`tax-${preference}`} />
                  <FieldLabel htmlFor={`tax-${preference}`} className="font-normal">
                    {preference}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
          </Field>
        )}
      />
      {taxPreference === "Tax Exempt" && (
        <FormInputField
          control={control}
          name="exemptionReason"
          label="Exemption Reason"
          orientation="horizontal"
          required
          autoComplete="off"
        />
      )}
      <Field className={HORIZONTAL_FIELD_CLASS}>
        <FormFieldLabel label="Currency" />
        <p className="text-sm">INR - Indian Rupee</p>
      </Field>
      <FormInputField
        control={control}
        name="openingBalance"
        label="Opening Balance"
        orientation="horizontal"
        hint="What the customer already owes you when you start using the app."
        startAddon="INR"
        inputMode="decimal"
      />
      <FormSelectField
        control={control}
        name="paymentTerms"
        label="Payment Terms"
        orientation="horizontal"
        options={toSelectOptions(PAYMENT_TERMS)}
        disabled={disabled}
      />
      <FormComboboxField
        control={control}
        name="priceListId"
        label="Price List"
        orientation="horizontal"
        hint="Rates from this sales price list are used on this customer's transactions."
        placeholder="None"
        searchPlaceholder="Search price lists"
        options={priceListOptions}
        disabled={disabled}
      />
      <FormComboboxField
        control={control}
        name="ownerId"
        label="Customer Owner"
        orientation="horizontal"
        hint="The person looking after this customer."
        placeholder="Select a user"
        searchPlaceholder="Search users"
        options={ownerOptions}
        disabled={disabled}
      />
    </FieldGroup>
  )
}

// A text box for the display name, like Zoho's: type any name, or pick one of the
// suggestions (built from the contact's name and the company) listed under it.
function DisplayNameField({ suggestions, disabled }: { suggestions: string[]; disabled: boolean }) {
  const { control } = useFormContext<CustomerInput>()
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const showList = isOpen && suggestions.length > 0

  return (
    <Controller
      control={control}
      name="displayName"
      render={({ field, fieldState }) => {
        function choose(value: string) {
          field.onChange(value)
          setIsOpen(false)
          setActiveIndex(-1)
        }

        return (
          <Field data-invalid={fieldState.invalid} className={HORIZONTAL_FIELD_CLASS}>
            <FormFieldLabel
              htmlFor="displayName"
              label="Display Name"
              required
              hint="The name shown on quotations, sales orders and invoices. Type one, or pick a suggestion."
            />
            <div className="relative">
              <Input
                {...field}
                id="displayName"
                role="combobox"
                aria-expanded={showList}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  showList && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
                }
                aria-invalid={fieldState.invalid}
                autoComplete="off"
                maxLength={200}
                placeholder="Type or pick a display name"
                disabled={disabled}
                onFocus={() => setIsOpen(true)}
                onBlur={() => {
                  setIsOpen(false)
                  setActiveIndex(-1)
                  field.onBlur()
                }}
                onChange={(event) => {
                  field.onChange(event.target.value)
                  setIsOpen(true)
                }}
                onKeyDown={(event) => {
                  if (!showList) {
                    if (event.key === "ArrowDown") setIsOpen(true)
                    return
                  }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault()
                    const step = event.key === "ArrowDown" ? 1 : -1
                    setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length)
                  } else if (event.key === "Enter" && activeIndex >= 0) {
                    event.preventDefault()
                    choose(suggestions[activeIndex])
                  } else if (event.key === "Escape") {
                    setIsOpen(false)
                    setActiveIndex(-1)
                  }
                }}
              />
              {showList && (
                <ul
                  id={listboxId}
                  role="listbox"
                  aria-label="Display name suggestions"
                  className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
                >
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion}
                      id={`${listboxId}-${index}`}
                      role="option"
                      aria-selected={suggestion === field.value}
                      // Keep focus in the box, so the click picks before the list closes.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(suggestion)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5",
                        index === activeIndex && "bg-accent text-accent-foreground"
                      )}
                    >
                      <span className="truncate">{suggestion}</span>
                      {suggestion === field.value && <Check className="size-4 shrink-0" />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}

// Billing and shipping addresses side by side; the shipping one can copy the billing one.
function Addresses({ disabled }: { disabled: boolean }) {
  const { getValues, setValue } = useFormContext<CustomerInput>()

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <AddressFields prefix="billing" title="Billing Address" disabled={disabled} />
      <AddressFields
        prefix="shipping"
        title="Shipping Address"
        disabled={disabled}
        action={
          !disabled && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() =>
                setValue("shipping", { ...getValues("billing") }, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              Copy billing address
            </Button>
          )
        }
      />
    </div>
  )
}

function AddressFields({
  prefix,
  title,
  disabled,
  action,
}: {
  prefix: "billing" | "shipping"
  title: string
  disabled: boolean
  action?: React.ReactNode
}) {
  const { control } = useFormContext<CustomerInput>()
  const country = useWatch({ control, name: `${prefix}.country` })
  const isIndia = country.trim().toLowerCase() === DEFAULT_COUNTRY.toLowerCase()
  // Every country, plus a saved one spelled differently (e.g. from an import).
  const countryOptions = toSelectOptions(
    country && !COUNTRIES.includes(country) ? [...COUNTRIES, country] : COUNTRIES
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {action}
      </div>
      <FieldGroup className="gap-4">
        <FormInputField
          control={control}
          name={`${prefix}.attention`}
          label="Attention"
          orientation="horizontal"
          autoComplete="off"
        />
        <FormComboboxField
          control={control}
          name={`${prefix}.country`}
          label="Country/Region"
          orientation="horizontal"
          placeholder="Select a country"
          searchPlaceholder="Search countries"
          options={countryOptions}
          disabled={disabled}
        />
        <FormInputField
          control={control}
          name={`${prefix}.street1`}
          label="Address"
          orientation="horizontal"
          placeholder="Street 1"
          autoComplete="off"
        />
        <div className={HORIZONTAL_FIELD_CLASS}>
          <span aria-hidden="true" />
          <RegisteredInput name={`${prefix}.street2`} label="Street 2" placeholder="Street 2" />
        </div>
        <FormInputField
          control={control}
          name={`${prefix}.city`}
          label="City"
          orientation="horizontal"
          autoComplete="off"
        />
        {isIndia ? (
          <FormComboboxField
            control={control}
            name={`${prefix}.state`}
            label="State"
            orientation="horizontal"
            placeholder="Select a state"
            searchPlaceholder="Search states"
            options={STATE_OPTIONS}
            disabled={disabled}
          />
        ) : (
          <FormInputField
            control={control}
            name={`${prefix}.state`}
            label="State"
            orientation="horizontal"
            autoComplete="off"
          />
        )}
        <FormInputField
          control={control}
          name={`${prefix}.pinCode`}
          label="Pin Code"
          orientation="horizontal"
          inputMode={isIndia ? "numeric" : undefined}
          autoComplete="off"
        />
        <FormInputField
          control={control}
          name={`${prefix}.phone`}
          label="Phone"
          orientation="horizontal"
          type="tel"
          autoComplete="off"
        />
        <FormInputField
          control={control}
          name={`${prefix}.fax`}
          label="Fax Number"
          orientation="horizontal"
          type="tel"
          autoComplete="off"
        />
      </FieldGroup>
    </section>
  )
}

const CONTACT_COLUMNS = [
  { key: "salutation", label: "Salutation", width: "w-32" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email Address" },
  { key: "workPhone", label: "Work Phone" },
  { key: "mobile", label: "Mobile" },
] as const

// Other people at the customer, one row each.
function ContactPersons({ disabled }: { disabled: boolean }) {
  const { control, getFieldState, formState } = useFormContext<CustomerInput>()
  const { fields, append, remove } = useFieldArray({ control, name: "contacts" })

  return (
    <div className="flex flex-col gap-3">
      {fields.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[56rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {CONTACT_COLUMNS.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "h-9 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                      "width" in column && column.width
                    )}
                  >
                    {column.label}
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id} className="align-top hover:bg-transparent">
                  <TableCell className="px-2 py-2">
                    <OptionalSelect
                      name={`contacts.${index}.salutation`}
                      label={`Salutation, contact ${index + 1}`}
                      placeholder="—"
                      options={toSelectOptions(SALUTATIONS)}
                      disabled={disabled}
                    />
                  </TableCell>
                  {CONTACT_COLUMNS.slice(1).map((column) => {
                    const name = `contacts.${index}.${column.key}` as const
                    const fieldError = getFieldState(name, formState).error
                    return (
                      <TableCell key={column.key} className="px-2 py-2">
                        <RegisteredInput
                          name={name}
                          label={`${column.label}, contact ${index + 1}`}
                          type={
                            column.key === "email"
                              ? "email"
                              : column.key === "workPhone" || column.key === "mobile"
                                ? "tel"
                                : "text"
                          }
                        />
                        {fieldError && <FieldError className="mt-1" errors={[fieldError]} />}
                      </TableCell>
                    )
                  })}
                  <TableCell className="px-1 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove contact ${index + 1}`}
                      disabled={disabled}
                      onClick={() => remove(index)}
                    >
                      <X />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No contact persons yet. Add the other people you deal with at this customer.
        </p>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => append({ ...EMPTY_CONTACT })}
        >
          <Plus />
          Add Contact Person
        </Button>
      </div>
    </div>
  )
}

// A plain input bound to the form, for grouped rows (name parts, phones, contact table)
// where each part has no label of its own on screen.
function RegisteredInput({
  name,
  label,
  placeholder,
  type = "text",
}: {
  name: FieldPath<CustomerInput>
  label: string
  placeholder?: string
  type?: string
}) {
  const { register, getFieldState, formState } = useFormContext<CustomerInput>()
  const { error } = getFieldState(name, formState)
  const id = name.replaceAll(".", "-")
  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={Boolean(error)}
        autoComplete="off"
        {...register(name)}
      />
      {/* Contact rows show their errors below the cell instead. */}
      {error && !name.startsWith("contacts.") && <FieldError errors={[error]} />}
    </div>
  )
}

// A phone number with a country code picker (India +91 by default).
function PhoneField({
  name,
  label,
  disabled,
}: {
  name: "workPhone" | "mobile"
  label: string
  disabled: boolean
}) {
  return (
    <Controller
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1">
          <PhoneInput
            id={name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            placeholder={label}
            aria-label={label}
            invalid={fieldState.invalid}
            disabled={disabled}
          />
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </div>
      )}
    />
  )
}

// A select where nothing picked is allowed (stored as "").
function OptionalSelect({
  name,
  label,
  placeholder,
  options,
  disabled,
}: {
  name: FieldPath<CustomerInput>
  label: string
  placeholder: string
  options: { value: string; label: string }[]
  disabled: boolean
}) {
  return (
    <Controller
      name={name}
      render={({ field }) => (
        <Select
          value={field.value ? String(field.value) : NONE}
          onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
          disabled={disabled}
        >
          <SelectTrigger aria-label={label} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{placeholder}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  )
}

export function CustomerFormSkeleton() {
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
        <div className="flex h-11 items-center gap-6 border-y px-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex max-w-2xl flex-col gap-4 p-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}
