"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { saveDespatch } from "@/actions/despatch"
import { FormError } from "@/components/shared/form-error"
import { FormFieldLabel, HORIZONTAL_FIELD_CLASS } from "@/components/shared/form-field-label"
import { FormInputField } from "@/components/shared/form-input-field"
import { FormTextareaField } from "@/components/shared/form-textarea-field"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ROUTES, despatchRoute } from "@/constants/routes"
import { DespatchOrderPicker } from "@/features/despatch/components/despatch-order-picker"
import type { DespatchOrder, DespatchOrderOption } from "@/features/despatch/queries"
import { formatQuantity, toMoneyInput } from "@/lib/format"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import { cn } from "@/lib/utils"
import { despatchSchema, type DespatchInput } from "@/lib/validations/despatch"

const HEAD_CLASS = "h-9 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"

type SaveStatus = "Packed" | "Despatched"

// A new despatch: pick a confirmed order, then how much of each item goes this time. Each
// line starts at everything left, so a full despatch needs no typing; lower it, or clear
// it, to send part of the order now and the rest later.
export function DespatchForm({
  options,
  order,
  today,
}: {
  options: DespatchOrderOption[]
  // Null until an order is picked.
  order: DespatchOrder | null
  today: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-0 py-0">
        <FieldGroup className="max-w-[34rem] p-6">
          <Field className={HORIZONTAL_FIELD_CLASS}>
            <FormFieldLabel label="Sales Order" required />
            <DespatchOrderPicker options={options} selected={order ?? undefined} />
          </Field>
        </FieldGroup>
      </Card>
      {/* A different order starts a fresh form. */}
      {order && <DespatchItemsForm key={order.id} order={order} today={today} />}
      {!order && (
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href={ROUTES.despatch}>Cancel</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function DespatchItemsForm({ order, today }: { order: DespatchOrder; today: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [savingAs, setSavingAs] = useState<SaveStatus>()
  const [error, setError] = useState<string>()
  const form = useForm<DespatchInput>({
    resolver: zodResolver(despatchSchema),
    // scrollToFirstInvalid does this, dropdowns included.
    shouldFocusError: false,
    defaultValues: {
      salesOrderId: order.id,
      date: today,
      transporter: "",
      trackingNumber: "",
      vehicleNumber: "",
      notes: "",
      lines: order.lines.map((line) => ({
        salesOrderItemId: line.id,
        quantity: line.remaining > 0 ? toMoneyInput(line.remaining) : "",
      })),
    },
  })
  const { errors } = form.formState
  const linesError = errors.lines?.root ?? errors.lines
  const nothingLeft = order.lines.every((line) => line.remaining === 0)

  function save(status: SaveStatus) {
    return form.handleSubmit((values) => {
      setError(undefined)
      setSavingAs(status)
      startTransition(async () => {
        const result = await saveDespatch(values, status)
        if (!result.success) {
          setError(result.error)
          toast.error(result.error)
          return
        }
        toast.success(status === "Packed" ? "Despatch saved as packed." : "Goods despatched.")
        router.push(despatchRoute(result.data.id))
      })
    }, scrollToFirstInvalid)
  }

  return (
    <form onSubmit={save("Packed")} noValidate className="flex flex-col gap-6">
      <FormError message={error} />
      <fieldset disabled={isPending} className="contents">
        <Card className="gap-0 py-0">
          <FieldGroup className="max-w-[34rem] gap-4 p-6">
            <FormInputField
              control={form.control}
              name="date"
              label="Despatch Date"
              orientation="horizontal"
              required
              type="date"
            />
            <FormInputField
              control={form.control}
              name="transporter"
              label="Transporter"
              orientation="horizontal"
              autoComplete="off"
            />
            <FormInputField
              control={form.control}
              name="trackingNumber"
              label="LR / Tracking Number"
              orientation="horizontal"
              autoComplete="off"
            />
            <FormInputField
              control={form.control}
              name="vehicleNumber"
              label="Vehicle Number"
              orientation="horizontal"
              autoComplete="off"
            />
            <FormTextareaField
              control={form.control}
              name="notes"
              label="Notes"
              orientation="horizontal"
              placeholder="Max. 500 characters"
              rows={3}
            />
          </FieldGroup>

          <section className="flex flex-col gap-4 border-t p-6">
            <h3 className="font-medium">Item Table</h3>
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={HEAD_CLASS}>Item Details</TableHead>
                    <TableHead className={cn(HEAD_CLASS, "w-28 text-right")}>Ordered</TableHead>
                    <TableHead className={cn(HEAD_CLASS, "w-28 text-right")}>Packed / Sent</TableHead>
                    <TableHead className={cn(HEAD_CLASS, "w-28 text-right")}>In Stock</TableHead>
                    <TableHead className={cn(HEAD_CLASS, "w-36 text-right")}>This Despatch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((line, index) => {
                    const quantityError = errors.lines?.[index]?.quantity
                    return (
                      <TableRow key={line.id} className="align-top hover:bg-transparent">
                        <TableCell className="px-3 py-2">
                          <span className="block font-medium whitespace-normal">{line.name}</span>
                          {line.sku && (
                            <span className="block text-xs text-muted-foreground">
                              SKU: {line.sku}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {formatQuantity(line.quantity, line.unit)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {formatQuantity(line.taken, line.unit)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {line.stock === null ? "—" : formatQuantity(line.stock, line.unit)}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            inputMode="decimal"
                            aria-label={`This despatch, ${line.name}`}
                            aria-invalid={Boolean(quantityError)}
                            placeholder="0"
                            disabled={isPending || line.remaining === 0}
                            className="text-right tabular-nums"
                            {...form.register(`lines.${index}.quantity`)}
                          />
                          {quantityError && (
                            <FieldError className="mt-1 text-right" errors={[quantityError]} />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {nothingLeft && (
              <p className="text-sm text-muted-foreground">
                Everything on this order is already packed or sent.
              </p>
            )}
            {linesError?.message && <FieldError errors={[linesError]} />}
          </section>
        </Card>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={ROUTES.despatch}>Cancel</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || nothingLeft}
          onClick={save("Packed")}
        >
          {isPending && savingAs === "Packed" && <Spinner />}
          Save as Packed
        </Button>
        <Button type="button" disabled={isPending || nothingLeft} onClick={save("Despatched")}>
          {isPending && savingAs === "Despatched" && <Spinner />}
          Save and Despatch
        </Button>
      </div>
    </form>
  )
}

export function DespatchFormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="gap-0 py-0">
        <div className="flex max-w-[34rem] items-center gap-4 p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </Card>
      <Card className="gap-0 py-0">
        <div className="flex max-w-[34rem] flex-col gap-4 p-6">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
