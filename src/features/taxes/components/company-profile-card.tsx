"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { saveCompanyProfile } from "@/actions/organization"
import { FormInputField } from "@/components/shared/form-input-field"
import { FormTextareaField } from "@/components/shared/form-textarea-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { CompanyImageField } from "@/features/taxes/components/company-image-field"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import {
  companyProfileSchema,
  type CompanyProfileInput,
} from "@/lib/validations/company-profile"

// Settings → Taxes: the business's own details, printed at the top (name, address,
// phone, email, GSTIN) and bottom (bank details) of quotations.
export function CompanyProfileCard({
  defaultValues,
  logoUrl,
  signatureUrl,
  canEdit,
}: {
  defaultValues: CompanyProfileInput
  logoUrl: string | null
  signatureUrl: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const form = useForm<CompanyProfileInput>({
    resolver: zodResolver(companyProfileSchema),
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues,
  })
  const disabled = !canEdit || isPending

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveCompanyProfile(values)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Company details saved.")
      form.reset(values)
      router.refresh()
    })
  }, scrollToFirstInvalid)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company details on quotations</CardTitle>
        <CardDescription>
          Printed at the top of every quotation, with your bank details at the bottom.
          {!canEdit && " Only owners and admins can change them."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
          <CompanyImageField
            kind="logo"
            label="Logo"
            hint="Top left of the quote. PNG, JPG or WebP, up to 2 MB."
            url={logoUrl}
            canEdit={canEdit}
          />
          <CompanyImageField
            kind="signature"
            label="Signature / Stamp"
            hint="Above Authorized Signature. A PNG with a clear background looks best."
            url={signatureUrl}
            canEdit={canEdit}
          />
        </div>
        <form onSubmit={submit} noValidate>
          <fieldset disabled={disabled} className="contents">
            <FieldGroup className="max-w-3xl gap-4">
              <FormInputField
                control={form.control}
                name="companyName"
                label="Company Name"
                orientation="horizontal"
                placeholder="HOTEL ESSENTIALS"
              />
              <FormTextareaField
                control={form.control}
                name="address"
                label="Address"
                orientation="horizontal"
                hint="One line per row, as it should print."
                rows={3}
              />
              <FormTextareaField
                control={form.control}
                name="address2"
                label="Second Address"
                orientation="horizontal"
                hint="Printed beside the first address, one line per row."
                rows={3}
              />
              <FormInputField
                control={form.control}
                name="phone"
                label="Phone"
                orientation="horizontal"
                autoComplete="off"
              />
              <FormInputField
                control={form.control}
                name="email"
                label="Email"
                orientation="horizontal"
                type="email"
                autoComplete="off"
              />
              <FormInputField
                control={form.control}
                name="gstin"
                label="GSTIN"
                orientation="horizontal"
                autoComplete="off"
                className="uppercase"
              />
              <FormInputField
                control={form.control}
                name="pan"
                label="PAN"
                orientation="horizontal"
                autoComplete="off"
                className="uppercase"
              />
              <FormTextareaField
                control={form.control}
                name="bankDetails"
                label="Bank Details"
                orientation="horizontal"
                hint="One line each, e.g. Bank A/C Name, Bank Name, A/C No, IFSC and Branch."
                placeholder={"Bank A/C Name: …\nBank Name: …\nA/C No: …\nIFSC: …\nBranch: …"}
                rows={5}
              />
              {canEdit && (
                <div className="flex justify-end">
                  <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                    {isPending && <Spinner />}
                    Save
                  </Button>
                </div>
              )}
            </FieldGroup>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}
