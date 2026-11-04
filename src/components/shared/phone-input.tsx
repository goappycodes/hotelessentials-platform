"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DEFAULT_DIAL_CODE, DIAL_CODES, joinPhone, splitPhone } from "@/constants/dial-codes"
import { cn } from "@/lib/utils"

type PhoneInputProps = {
  id?: string
  // The whole number with its country code, e.g. "+91 98300 12345"; "" when empty.
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  "aria-label"?: string
}

// A phone number with a country code picker in front (India +91 by default). Stores
// one value, "+91 98300 12345", so it fits a single text column.
export function PhoneInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  invalid,
  "aria-label": ariaLabel,
}: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  // The code picked while there's no number yet (an empty value holds no code).
  const [emptyCode, setEmptyCode] = useState(DEFAULT_DIAL_CODE)
  const parsed = splitPhone(value)
  const code = value ? parsed.code : emptyCode
  const number = value ? parsed.number : ""

  function chooseCode(next: string) {
    if (value) onChange(joinPhone(next, number))
    else setEmptyCode(next)
    setIsOpen(false)
  }

  return (
    <div className="flex">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            aria-label={`Country code for ${ariaLabel ?? "phone"}: ${code}`}
            disabled={disabled}
            className="w-[4.75rem] shrink-0 justify-between rounded-r-none border-r-0 px-2 font-normal tabular-nums"
          >
            {code}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Search country or code" />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {DIAL_CODES.map((entry) => (
                  <CommandItem
                    key={entry.country}
                    // Searchable by country name and code.
                    value={`${entry.country} ${entry.code}`}
                    data-checked={entry.code === code}
                    onSelect={() => chooseCode(entry.code)}
                    className="justify-between"
                  >
                    <span className="truncate">{entry.country}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{entry.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={number}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(event) => onChange(joinPhone(code, event.target.value))}
        className={cn("min-w-0 rounded-l-none")}
      />
    </div>
  )
}
