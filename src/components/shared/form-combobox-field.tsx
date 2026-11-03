"use client"

import { ChevronDown, Plus } from "lucide-react"
import { useState } from "react"
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
import type { SelectOption } from "@/components/shared/form-select-field"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type FormComboboxFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  options: readonly SelectOption[]
  // Heading above the options, e.g. "Tax Group".
  groupLabel?: string
  placeholder?: string
  searchPlaceholder?: string
  description?: string
  disabled?: boolean
  // Offers the typed text as an extra option when it matches nothing exactly,
  // e.g. "Add HSN code “7321”". Receives the typed text.
  onCreate?: (search: string) => void
  createLabel?: (search: string) => string
  orientation?: FieldOrientation
  required?: boolean
  hint?: string
}

// A select with a search box, for longer option lists (shadcn combobox pattern).
export function FormComboboxField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  groupLabel,
  placeholder = "Select…",
  searchPlaceholder = "Search",
  description,
  disabled,
  onCreate,
  createLabel = (search) => `Add “${search}”`,
  orientation = "vertical",
  required,
  hint,
}: FormComboboxFieldProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const term = search.trim()
  const canCreate =
    Boolean(onCreate && term) &&
    !options.some((option) => option.label.toLowerCase() === term.toLowerCase())

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) setSearch("")
  }

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = options.find((option) => option.value === field.value)

        return (
          <Field
            data-invalid={fieldState.invalid}
            className={cn(orientation === "horizontal" && HORIZONTAL_FIELD_CLASS)}
          >
            <FormFieldLabel htmlFor={field.name} label={label} required={required} hint={hint} />
            <Popover open={isOpen} onOpenChange={handleOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  id={field.name}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-invalid={fieldState.invalid}
                  aria-required={required || undefined}
                  disabled={disabled}
                  onBlur={field.onBlur}
                  className="w-full justify-between font-normal"
                >
                  <span className={cn("truncate", !selected && "text-muted-foreground")}>
                    {selected?.label ?? placeholder}
                  </span>
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
                <Command>
                  <CommandInput
                    value={search}
                    onValueChange={setSearch}
                    placeholder={searchPlaceholder}
                  />
                  <CommandList>
                    {!canCreate && <CommandEmpty>No matches.</CommandEmpty>}
                    {options.length > 0 && (
                      <CommandGroup heading={groupLabel}>
                        {options.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            data-checked={option.value === field.value}
                            onSelect={() => {
                              field.onChange(option.value)
                              handleOpenChange(false)
                            }}
                          >
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {canCreate && (
                      <CommandGroup forceMount>
                        <CommandItem
                          // Always shown while it applies, whatever cmdk's filter thinks.
                          forceMount
                          value={`create:${term}`}
                          onSelect={() => {
                            onCreate?.(term)
                            handleOpenChange(false)
                          }}
                          className="text-primary"
                        >
                          <Plus />
                          {createLabel(term)}
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
