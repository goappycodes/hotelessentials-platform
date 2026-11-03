"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { saveTaxRate } from "@/actions/taxes"
import { FormError } from "@/components/shared/form-error"
import { FormFieldLabel } from "@/components/shared/form-field-label"
import { FormInputField } from "@/components/shared/form-input-field"
import { SubmitButton } from "@/components/shared/submit-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ROUTES } from "@/constants/routes"
import { TAX_SCOPE_DESCRIPTIONS, TAX_SCOPES } from "@/constants/taxes"
import { taxRateSchema, type TaxRateInput } from "@/lib/validations/tax"

const NEW_TAX: TaxRateInput = {
  name: "",
  taxScope: "Intra-state",
  cgstRate: "",
  sgstRate: "",
  igstRate: "",
  isActive: true,
}

type TaxFormProps =
  | { mode: "create" }
  | { mode: "edit"; taxId: string; defaultValues: TaxRateInput }

export function TaxForm(props: TaxFormProps) {
  const { mode } = props
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  const form = useForm<TaxRateInput>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: mode === "edit" ? props.defaultValues : NEW_TAX,
  })
  const [taxScope, cgstRate, sgstRate] = useWatch({
    control: form.control,
    name: ["taxScope", "cgstRate", "sgstRate"],
  })
  const total = (Number(cgstRate) || 0) + (Number(sgstRate) || 0)

  function onSubmit(values: TaxRateInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await saveTaxRate(mode === "edit" ? props.taxId : null, values)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(mode === "create" ? "Tax created." : "Tax updated.")
      router.push(ROUTES.taxes)
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError message={error} />
      <fieldset disabled={isPending} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Tax details</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <Controller
                control={form.control}
                name="taxScope"
                render={({ field }) => (
                  <Field>
                    <FormFieldLabel label="Type" required />
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {TAX_SCOPES.map((scope) => (
                        <FieldLabel
                          key={scope}
                          htmlFor={`scope-${scope}`}
                          className="rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                        >
                          <Field orientation="horizontal">
                            <RadioGroupItem value={scope} id={`scope-${scope}`} />
                            <FieldContent>
                              <span className="font-medium">{scope}</span>
                              <FieldDescription>{TAX_SCOPE_DESCRIPTIONS[scope]}</FieldDescription>
                            </FieldContent>
                          </Field>
                        </FieldLabel>
                      ))}
                    </RadioGroup>
                  </Field>
                )}
              />
              <FormInputField
                control={form.control}
                name="name"
                required
                label="Name"
                placeholder={taxScope === "Intra-state" ? "e.g. GST18" : "e.g. IGST18"}
                autoComplete="off"
              />
              {taxScope === "Intra-state" ? (
                <div className="grid gap-5 sm:grid-cols-3">
                  <FormInputField
                    control={form.control}
                    name="cgstRate"
                    required
                    label="CGST"
                    endAddon="%"
                    inputMode="decimal"
                    placeholder="9"
                  />
                  <FormInputField
                    control={form.control}
                    name="sgstRate"
                    required
                    label="SGST"
                    endAddon="%"
                    inputMode="decimal"
                    placeholder="9"
                  />
                  <Field>
                    <FieldLabel>Total</FieldLabel>
                    <p className="flex h-8 items-center text-sm font-medium tabular-nums">
                      {Number(total.toFixed(2))}%
                    </p>
                  </Field>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-3">
                  <FormInputField
                    control={form.control}
                    name="igstRate"
                    required
                    label="IGST"
                    endAddon="%"
                    inputMode="decimal"
                    placeholder="18"
                  />
                </div>
              )}
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
                        disabled={isPending}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="isActive">Active</FieldLabel>
                        <FieldDescription>
                          Inactive taxes can&apos;t be picked for items. Items already using
                          this tax keep it.
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  )}
                />
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={ROUTES.taxes}>Cancel</Link>
        </Button>
        <SubmitButton pending={isPending}>
          {mode === "create" ? "Save tax" : "Update"}
        </SubmitButton>
      </div>
    </form>
  )
}

export function TaxFormSkeleton() {
  return (
    <Card aria-busy="true">
      <span className="sr-only">Loading…</span>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
