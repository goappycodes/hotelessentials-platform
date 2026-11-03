"use client"

import { Check, ChevronDown, Plus } from "lucide-react"
import { useId, useRef, useState } from "react"
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
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const MAX_VISIBLE_OPTIONS = 50

type FormAutocompleteFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  options: readonly SelectOption[]
  placeholder?: string
  description?: string
  disabled?: boolean
  // Offers what was typed as a new entry when no option starts with it,
  // e.g. "Add HSN code “7321”". Receives the typed text.
  onCreate?: (text: string) => void
  createLabel?: (text: string) => string
  orientation?: FieldOrientation
  required?: boolean
  hint?: string
}

// A text box you type straight into: matching options drop down underneath, like Zoho's
// "Type to add or search" fields. Shows the chosen option's label when not editing.
export function FormAutocompleteField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  description,
  disabled,
  onCreate,
  createLabel = (text) => `Add “${text}”`,
  orientation = "vertical",
  required,
  hint,
}: FormAutocompleteFieldProps<T>) {
  const listboxId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  // null while not editing, so the box shows the selected option instead.
  const [query, setQuery] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const term = (query ?? "").trim()
  const lowerTerm = term.toLowerCase()
  const matches = (
    lowerTerm
      ? options.filter((option) => option.label.toLowerCase().includes(lowerTerm))
      : options
  ).slice(0, MAX_VISIBLE_OPTIONS)
  const canCreate =
    Boolean(onCreate && term) &&
    !options.some((option) => {
      const optionLabel = option.label.toLowerCase()
      return optionLabel === lowerTerm || optionLabel.startsWith(`${lowerTerm} `)
    })
  const optionCount = matches.length + (canCreate ? 1 : 0)

  function close() {
    setIsOpen(false)
    setActiveIndex(-1)
    setQuery(null)
  }

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = options.find((option) => option.value === field.value)

        function choose(value: string) {
          field.onChange(value)
          close()
        }

        function create() {
          onCreate?.(term)
          close()
        }

        function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            setIsOpen(true)
            if (optionCount === 0) return
            const step = event.key === "ArrowDown" ? 1 : -1
            setActiveIndex((index) => (index + step + optionCount) % optionCount)
          } else if (event.key === "Enter" && isOpen) {
            // Keep Enter from submitting the form while choosing.
            event.preventDefault()
            const option = matches[activeIndex]
            if (option) choose(option.value)
            else if (canCreate && (activeIndex === matches.length || matches.length === 0)) create()
          } else if (event.key === "Escape" && isOpen) {
            event.preventDefault()
            close()
          }
        }

        return (
          <Field
            data-invalid={fieldState.invalid}
            className={cn(orientation === "horizontal" && HORIZONTAL_FIELD_CLASS)}
          >
            <FormFieldLabel htmlFor={field.name} label={label} required={required} hint={hint} />
            <Popover open={isOpen && optionCount > 0} onOpenChange={(open) => !open && close()}>
              <PopoverAnchor asChild>
                <InputGroup ref={anchorRef}>
                  <InputGroupInput
                    id={field.name}
                    value={query ?? selected?.label ?? ""}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                      isOpen && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
                    }
                    aria-invalid={fieldState.invalid}
                    aria-required={required || undefined}
                    onFocus={(event) => {
                      event.currentTarget.select()
                      setIsOpen(true)
                    }}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setIsOpen(true)
                      setActiveIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      // Emptying the box clears the choice; otherwise keep it.
                      if (query !== null && query.trim() === "") field.onChange("")
                      field.onBlur()
                      close()
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <ChevronDown
                      className={cn(
                        "text-muted-foreground transition-transform",
                        isOpen && optionCount > 0 && "rotate-180"
                      )}
                    />
                  </InputGroupAddon>
                </InputGroup>
              </PopoverAnchor>
              <PopoverContent
                align="start"
                className="w-(--radix-popover-trigger-width) p-1"
                // Typing continues in the box while the list is open.
                onOpenAutoFocus={(event) => event.preventDefault()}
                onInteractOutside={(event) => {
                  if (event.target instanceof Node && anchorRef.current?.contains(event.target)) {
                    event.preventDefault()
                  }
                }}
              >
                <div
                  id={listboxId}
                  role="listbox"
                  aria-label={label}
                  onMouseDown={(event) => event.preventDefault()}
                  className="max-h-64 overflow-y-auto"
                >
                  {matches.map((option, index) => {
                    const isSelected = option.value === field.value
                    return (
                      <div
                        key={option.value}
                        id={`${listboxId}-${index}`}
                        role="option"
                        aria-selected={isSelected}
                        data-active={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(option.value)}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                      >
                        <span className="flex-1 truncate">{option.label}</span>
                        {isSelected && <Check className="size-4 text-primary" />}
                      </div>
                    )
                  })}
                  {canCreate && (
                    <div
                      id={`${listboxId}-${matches.length}`}
                      role="option"
                      aria-selected={false}
                      data-active={activeIndex === matches.length}
                      onMouseEnter={() => setActiveIndex(matches.length)}
                      onClick={create}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary data-[active=true]:bg-accent",
                        matches.length > 0 && "mt-1 border-t pt-2"
                      )}
                    >
                      <Plus className="size-4" />
                      {createLabel(term)}
                    </div>
                  )}
                </div>
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
