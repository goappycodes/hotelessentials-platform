"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PackagePlus, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"

import { saveDespatch } from "@/actions/despatch"
import { FormError } from "@/components/shared/form-error"
import {
  FieldHint,
  FormFieldLabel,
  HORIZONTAL_FIELD_CLASS,
} from "@/components/shared/form-field-label"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DESPATCH_HINTS } from "@/constants/despatch"
import { ROUTES, despatchRoute } from "@/constants/routes"
import { DespatchOrderPicker } from "@/features/despatch/components/despatch-order-picker"
import type { DespatchOrder, DespatchOrderOption } from "@/features/despatch/queries"
import { formatQuantity, toMoneyInput } from "@/lib/format"
import { scrollToFirstInvalid } from "@/lib/scroll-to-invalid"
import { cn } from "@/lib/utils"
import { despatchSchema, type DespatchInput } from "@/lib/validations/despatch"

const HEAD_CLASS = "h-9 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"

type SaveStatus = "Packed" | "Despatched"

function HeadWithHint({
  label,
  hint,
  className,
}: {
  label: string
  hint: string
  className?: string
}) {
  return (
    <TableHead className={cn(HEAD_CLASS, className)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <FieldHint label={label} hint={hint} />
      </span>
    </TableHead>
  )
}

// A button with a short tooltip. The span keeps the tooltip working while it's disabled.
function ButtonHint({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{hint}</TooltipContent>
    </Tooltip>
  )
}

// A new despatch: pick a confirmed order, then which box each item goes in and how many.
// Each item starts with everything left in one box; lower or clear it to send part of the
// order now and the rest later, or add a box to split the item.
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
            <FormFieldLabel label="Sales Order" required hint={DESPATCH_HINTS.salesOrder} />
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
        boxNumber: "",
        quantity: line.remaining > 0 ? toMoneyInput(line.remaining) : "",
      })),
    },
  })
  const { fields, insert, remove } = useFieldArray({ control: form.control, name: "lines" })
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
              hint={DESPATCH_HINTS.date}
              required
              type="date"
            />
            <FormInputField
              control={form.control}
              name="transporter"
              label="Transporter"
              orientation="horizontal"
              hint={DESPATCH_HINTS.transporter}
              autoComplete="off"
            />
            <FormInputField
              control={form.control}
              name="trackingNumber"
              label="LR / Tracking Number"
              orientation="horizontal"
              hint={DESPATCH_HINTS.trackingNumber}
              autoComplete="off"
            />
            <FormInputField
              control={form.control}
              name="vehicleNumber"
              label="Vehicle Number"
              orientation="horizontal"
              hint={DESPATCH_HINTS.vehicleNumber}
              autoComplete="off"
            />
            <FormTextareaField
              control={form.control}
              name="notes"
              label="Notes"
              orientation="horizontal"
              hint={DESPATCH_HINTS.notes}
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
                    <HeadWithHint
                      label="Packed / Sent"
                      hint={DESPATCH_HINTS.packedSent}
                      className="w-32 text-right"
                    />
                    <HeadWithHint
                      label="In Stock"
                      hint={DESPATCH_HINTS.inStock}
                      className="w-28 text-right"
                    />
                    <HeadWithHint
                      label="Box No"
                      hint={DESPATCH_HINTS.boxNumber}
                      className="w-32"
                    />
                    <HeadWithHint
                      label="Qty in Box"
                      hint={DESPATCH_HINTS.boxQuantity}
                      className="w-32 text-right"
                    />
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const line = order.lines.find((entry) => entry.id === field.salesOrderItemId)
                    if (!line) return null
                    // The item's details show once, on its first box.
                    const isFirstBox = fields[index - 1]?.salesOrderItemId !== line.id
                    const isLastBox = fields[index + 1]?.salesOrderItemId !== line.id
                    const boxError = errors.lines?.[index]?.boxNumber
                    const quantityError = errors.lines?.[index]?.quantity
                    const disabled = isPending || line.remaining === 0
                    return (
                      <TableRow key={field.id} className="align-top hover:bg-transparent">
                        <TableCell className="px-3 py-2">
                          {isFirstBox && (
                            <>
                              <span className="block font-medium whitespace-normal">{line.name}</span>
                              {line.sku && (
                                <span className="block text-xs text-muted-foreground">
                                  SKU: {line.sku}
                                </span>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {isFirstBox && formatQuantity(line.quantity, line.unit)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {isFirstBox && formatQuantity(line.taken, line.unit)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {isFirstBox &&
                            (line.stock === null ? "—" : formatQuantity(line.stock, line.unit))}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            aria-label={`Box number, ${line.name}`}
                            aria-invalid={Boolean(boxError)}
                            placeholder="Box No"
                            maxLength={20}
                            autoComplete="off"
                            disabled={disabled}
                            {...form.register(`lines.${index}.boxNumber`)}
                          />
                          {boxError && <FieldError className="mt-1" errors={[boxError]} />}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            inputMode="decimal"
                            aria-label={`Quantity in box, ${line.name}`}
                            aria-invalid={Boolean(quantityError)}
                            placeholder="0"
                            disabled={disabled}
                            className="text-right tabular-nums"
                            {...form.register(`lines.${index}.quantity`)}
                          />
                          {quantityError && (
                            <FieldError className="mt-1 text-right" errors={[quantityError]} />
                          )}
                        </TableCell>
                        <TableCell className="px-1 py-2">
                          <div className="flex justify-end">
                            {isLastBox && (
                              <ButtonHint hint={DESPATCH_HINTS.addBox}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Add another box for ${line.name}`}
                                  disabled={disabled}
                                  onClick={() =>
                                    insert(index + 1, {
                                      salesOrderItemId: line.id,
                                      boxNumber: "",
                                      quantity: "",
                                    })
                                  }
                                >
                                  <PackagePlus />
                                </Button>
                              </ButtonHint>
                            )}
                            {!(isFirstBox && isLastBox) && (
                              <ButtonHint hint={DESPATCH_HINTS.removeBox}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Remove this box for ${line.name}`}
                                  disabled={disabled}
                                  onClick={() => remove(index)}
                                >
                                  <X />
                                </Button>
                              </ButtonHint>
                            )}
                          </div>
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
        <ButtonHint hint={DESPATCH_HINTS.savePacked}>
          <Button
            type="button"
            variant="outline"
            disabled={isPending || nothingLeft}
            onClick={save("Packed")}
          >
            {isPending && savingAs === "Packed" && <Spinner />}
            Save as Packed
          </Button>
        </ButtonHint>
        <ButtonHint hint={DESPATCH_HINTS.saveDespatched}>
          <Button type="button" disabled={isPending || nothingLeft} onClick={save("Despatched")}>
            {isPending && savingAs === "Despatched" && <Spinner />}
            Save and Despatch
          </Button>
        </ButtonHint>
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
