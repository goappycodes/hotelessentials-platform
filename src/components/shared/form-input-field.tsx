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
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type FormInputFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  labelAction?: React.ReactNode
  // Short text inside the input, e.g. "₹" before or "%" after the value.
  startAddon?: string
  endAddon?: string
  // Label on the left of the control instead of above it.
  orientation?: FieldOrientation
  required?: boolean
  hint?: string
} & Omit<React.ComponentProps<typeof Input>, "name" | "id">

export function FormInputField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  labelAction,
  startAddon,
  endAddon,
  orientation = "vertical",
  required,
  hint,
  ...inputProps
}: FormInputFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const controlProps = {
          ...inputProps,
          ...field,
          id: field.name,
          "aria-invalid": fieldState.invalid,
          "aria-required": required || undefined,
        }

        return (
          <Field
            data-invalid={fieldState.invalid}
            className={cn(orientation === "horizontal" && HORIZONTAL_FIELD_CLASS)}
          >
            <div className="flex items-center justify-between gap-2">
              <FormFieldLabel htmlFor={field.name} label={label} required={required} hint={hint} />
              {labelAction}
            </div>
            {startAddon || endAddon ? (
              <InputGroup>
                {startAddon && (
                  <InputGroupAddon>
                    <InputGroupText>{startAddon}</InputGroupText>
                  </InputGroupAddon>
                )}
                <InputGroupInput {...controlProps} />
                {endAddon && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{endAddon}</InputGroupText>
                  </InputGroupAddon>
                )}
              </InputGroup>
            ) : (
              <Input {...controlProps} />
            )}
            {description && !fieldState.invalid && (
              <FieldDescription>{description}</FieldDescription>
            )}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
