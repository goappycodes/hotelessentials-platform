"use client"

import { useState, useTransition } from "react"
import { useFormContext, useWatch } from "react-hook-form"

import { createHsnCode } from "@/actions/items"
import { FormAutocompleteField } from "@/components/shared/form-autocomplete-field"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { hsnCodeSchema, type ItemInput } from "@/lib/validations/item"

// description is null for codes added by an import.
export type HsnCode = { id: string; code: string; description: string | null }

export function formatHsnCode(hsn: Pick<HsnCode, "code" | "description">) {
  return hsn.description ? `${hsn.code} · ${hsn.description}` : hsn.code
}

type HsnCodeFieldProps = {
  hsnCodes: HsnCode[]
  onCreated: (hsnCode: HsnCode) => void
  disabled?: boolean
}

// Search HSN codes, or type a new one to add it without leaving the item form.
export function HsnCodeField({ hsnCodes, onCreated, disabled }: HsnCodeFieldProps) {
  const { control, setValue } = useFormContext<ItemInput>()
  const type = useWatch({ control, name: "type" })
  const [isAdding, setIsAdding] = useState(false)
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string>()
  const [isSaving, startSaving] = useTransition()

  // Digits are taken as the code; anything else as the description.
  function startAdding(search: string) {
    const isCode = /^\d+$/.test(search)
    setCode(isCode ? search.slice(0, 8) : "")
    setDescription(isCode ? "" : search)
    setError(undefined)
    setIsAdding(true)
  }

  function add() {
    const parsed = hsnCodeSchema.safeParse({ code, description })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message)
      return
    }
    setError(undefined)
    startSaving(async () => {
      const result = await createHsnCode(parsed.data)
      if (!result.success) {
        setError(result.error)
        return
      }
      onCreated(result.data)
      setValue("hsnCodeId", result.data.id, { shouldValidate: true, shouldDirty: true })
      setIsAdding(false)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <FormAutocompleteField
        control={control}
        name="hsnCodeId"
        label="HSN Code"
        orientation="horizontal"
        hint={
          type === "Service"
            ? "The SAC code for this service."
            : "The HSN code printed on GST invoices for this item."
        }
        placeholder="Type to add or search"
        options={hsnCodes.map((hsn) => ({ value: hsn.id, label: formatHsnCode(hsn) }))}
        onCreate={startAdding}
        createLabel={(search) => `Add HSN code “${search}”`}
        disabled={disabled}
      />
      {isAdding && (
        // Not a <form>: it sits inside the item form. Lines up under the field.
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:ml-40">
          <p className="text-sm font-medium">New HSN code</p>
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Code, e.g. 7321"
              aria-label="HSN code"
              inputMode="numeric"
              maxLength={8}
            />
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description, e.g. Cooking ranges of iron or steel"
              aria-label="HSN description"
              maxLength={300}
            />
          </div>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={add} disabled={isSaving}>
              {isSaving && <Spinner />}
              Add HSN code
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
