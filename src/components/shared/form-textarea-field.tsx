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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type FormTextareaFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  orientation?: FieldOrientation
  required?: boolean
  hint?: string
} & Omit<React.ComponentProps<typeof Textarea>, "name" | "id">

export function FormTextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  orientation = "vertical",
  required,
  hint,
  ...textareaProps
}: FormTextareaFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          data-invalid={fieldState.invalid}
          // A multi-line box keeps its label level with the first line.
          className={cn(
            orientation === "horizontal" &&
              `${HORIZONTAL_FIELD_CLASS} sm:items-start sm:*:data-[slot=field-label]:pt-2`
          )}
        >
          <FormFieldLabel htmlFor={field.name} label={label} required={required} hint={hint} />
          <Textarea
            {...textareaProps}
            {...field}
            id={field.name}
            aria-invalid={fieldState.invalid}
            aria-required={required || undefined}
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
