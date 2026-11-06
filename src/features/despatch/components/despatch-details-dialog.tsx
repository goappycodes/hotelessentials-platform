"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { updateDespatchDetails } from "@/actions/despatch"
import { FormInputField } from "@/components/shared/form-input-field"
import { FormTextareaField } from "@/components/shared/form-textarea-field"
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
import type { DespatchDocumentData } from "@/features/despatch/queries"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import { despatchDetailsSchema, type DespatchDetailsInput } from "@/lib/validations/despatch"

// The date, transporter and tracking details, which can change at any status.
export function DespatchDetailsDialog({
  despatch,
  open,
  onOpenChange,
  onSaved,
}: {
  despatch: DespatchDocumentData["despatch"]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<DespatchDetailsInput>({
    resolver: zodResolver(despatchDetailsSchema),
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues: {
      date: despatch.despatch_date,
      transporter: despatch.transporter ?? "",
      trackingNumber: despatch.tracking_number ?? "",
      vehicleNumber: despatch.vehicle_number ?? "",
      notes: despatch.notes ?? "",
    },
  })

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateDespatchDetails(despatch.id, values)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Details saved.")
      onOpenChange(false)
      onSaved()
    })
  }, scrollToFirstInvalid)

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transport Details</DialogTitle>
          <DialogDescription>
            Printed on {despatch.despatch_number}. Items and quantities can&apos;t be changed here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <fieldset disabled={isPending} className="contents">
            <FieldGroup className="gap-4">
              <FormInputField
                control={form.control}
                name="date"
                label="Despatch Date"
                required
                type="date"
              />
              <FormInputField
                control={form.control}
                name="transporter"
                label="Transporter"
                autoComplete="off"
              />
              <FormInputField
                control={form.control}
                name="trackingNumber"
                label="LR / Tracking Number"
                autoComplete="off"
              />
              <FormInputField
                control={form.control}
                name="vehicleNumber"
                label="Vehicle Number"
                autoComplete="off"
              />
              <FormTextareaField
                control={form.control}
                name="notes"
                label="Notes"
                placeholder="Max. 500 characters"
                rows={3}
              />
            </FieldGroup>
          </fieldset>
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
