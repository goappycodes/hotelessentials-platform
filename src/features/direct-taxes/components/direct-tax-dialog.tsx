"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { saveDirectTax, type DirectTaxRate } from "@/actions/direct-taxes"
import { FormInputField } from "@/components/shared/form-input-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import { directTaxSchema, type DirectTaxInput } from "@/lib/validations/direct-tax"
import type { Enums } from "@/types/database"

// New TDS / TCS Tax (or editing one): a name and a percentage.
export function DirectTaxDialog({
  open,
  onOpenChange,
  kind,
  rate,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: Enums<"direct_tax_kind">
  // The rate being edited; none for a new one.
  rate?: DirectTaxRate
  onSaved: (rate: DirectTaxRate) => void
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<DirectTaxInput>({
    resolver: zodResolver(directTaxSchema),
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues: { kind, name: "", rate: "" },
  })

  // Fresh values each time it opens.
  useEffect(() => {
    if (open) {
      form.reset({ kind, name: rate?.name ?? "", rate: rate ? String(rate.rate) : "" })
    }
  }, [open, kind, rate, form])

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveDirectTax(rate?.id ?? null, values)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(rate ? `${kind} rate updated.` : `${kind} rate added.`)
      onSaved(result.data)
      onOpenChange(false)
    })
  }, scrollToFirstInvalid)

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(event) => {
            // The dialog can open from inside the quotation form: don't submit that too.
            event.stopPropagation()
            void submit(event)
          }}
          noValidate
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle>{rate ? `Edit ${kind} Tax` : `New ${kind} Tax`}</DialogTitle>
            <DialogDescription>
              {kind === "TDS"
                ? "Tax deducted at source: taken off the quotation total."
                : "Tax collected at source: added to the quotation total."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <FormInputField
              control={form.control}
              name="name"
              label="Tax Name"
              required
              placeholder={kind === "TDS" ? "Professional Fees" : "Sale of Goods"}
              autoComplete="off"
              disabled={isPending}
            />
            <FormInputField
              control={form.control}
              name="rate"
              label="Rate"
              required
              endAddon="%"
              inputMode="decimal"
              placeholder="10"
              autoComplete="off"
              disabled={isPending}
            />
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
