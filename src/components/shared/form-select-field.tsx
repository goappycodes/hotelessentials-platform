"use client"

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import {
  FormFieldLabel,
  HORIZONTAL_FIELD_CLASS,
  type FieldOrientation,
} from "@/components/shared/form-field-label"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type SelectOption = { value: string; label: string }

type FormSelectFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  options: readonly SelectOption[]
  placeholder?: string
  description?: string
  disabled?: boolean
  labelAction?: React.ReactNode
  onValueChange?: (value: string) => void
  // Label on the left of the control instead of above it.
  orientation?: FieldOrientation
  required?: boolean
  hint?: string
}

export function FormSelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = "Select…",
  description,
  disabled,
  labelAction,
  onValueChange,
  orientation = "vertical",
  required,
  hint,
}: FormSelectFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          data-invalid={fieldState.invalid}
          className={cn(orientation === "horizontal" && HORIZONTAL_FIELD_CLASS)}
        >
          <div className="flex items-center justify-between gap-2">
            <FormFieldLabel htmlFor={field.name} label={label} required={required} hint={hint} />
            {labelAction}
          </div>
          <Select
            value={field.value}
            disabled={disabled}
            onValueChange={(value) => {
              field.onChange(value)
              onValueChange?.(value)
            }}
          >
            <SelectTrigger
              id={field.name}
              className="w-full"
              aria-invalid={fieldState.invalid}
              aria-required={required || undefined}
              onBlur={field.onBlur}
            >
              {/* Explicit label so the server render isn't blank. */}
              <SelectValue placeholder={placeholder}>
                {options.find((option) => option.value === field.value)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && !fieldState.invalid && (
            <FieldDescription>{description}</FieldDescription>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export function toSelectOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }))
}
