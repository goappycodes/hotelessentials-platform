"use client"

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type FormInputFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  labelAction?: React.ReactNode
} & Omit<React.ComponentProps<typeof Input>, "name" | "id">

export function FormInputField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  labelAction,
  ...inputProps
}: FormInputFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
            {labelAction}
          </div>
          <Input
            {...inputProps}
            {...field}
            id={field.name}
            aria-invalid={fieldState.invalid}
          />
          {description && !fieldState.invalid && (
            <FieldDescription>{description}</FieldDescription>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
