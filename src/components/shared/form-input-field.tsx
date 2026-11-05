
"use client"

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import { Eye, EyeOff } from "lucide-react"

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
import { useState } from "react"

type FormInputFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  labelAction?: React.ReactNode
  startAddon?: string
  endAddon?: string
  orientation?: FieldOrientation
  required?: boolean
  hint?: string
  showPasswordToggle?: boolean
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
  showPasswordToggle = false,
  type = "text",
  ...inputProps
}: FormInputFieldProps<T>) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const isPassword = type === "password"
  const inputType =
    isPassword && showPasswordToggle
      ? isPasswordVisible ? "text" : "password"
      : type

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const controlProps = {
          ...inputProps,
          ...field,
          id: field.name,
          type: inputType,
          "aria-invalid": fieldState.invalid,
          "aria-required": required || undefined,
        }

        return (
          <Field
            data-invalid={fieldState.invalid}
            className={cn(orientation === "horizontal" && HORIZONTAL_FIELD_CLASS)}
          >
            <div className="flex items-center justify-between gap-2">
              <FormFieldLabel
                htmlFor={field.name}
                label={label}
                required={required}
                hint={hint}
              />
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

                {isPassword && showPasswordToggle && (
                  <InputGroupAddon align="inline-end">
                    <button
                      type="button"
                      onClick={() => setIsPasswordVisible((prev) => !prev)}
                      aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isPasswordVisible ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </InputGroupAddon>
                )}
              </InputGroup>
            ) : (
              <div className="relative">
                <Input
                  {...controlProps}
                  className={cn(
                    showPasswordToggle && isPassword && "pr-10",
                    inputProps.className
                  )}
                />

                {isPassword && showPasswordToggle && (
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                )}
              </div>
            )}

            {description && !fieldState.invalid && (
              <FieldDescription>{description}</FieldDescription>
            )}

            {fieldState.invalid && (
              <FieldError errors={[fieldState.error]} />
            )}
          </Field>
        )
      }}
    />
  )
}
