"use client"

import { ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { newDespatchForOrderRoute } from "@/constants/routes"
import type { DespatchOrderOption } from "@/features/despatch/queries"
import { formatDay } from "@/lib/format"
import { cn } from "@/lib/utils"

// Picks the confirmed order to despatch. Choosing one reloads the page with its items.
export function DespatchOrderPicker({
  options,
  selected,
}: {
  options: DespatchOrderOption[]
  selected?: DespatchOrderOption
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-label="Sales Order"
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected
              ? `${selected.so_number} · ${selected.customer_name}`
              : "Select a confirmed sales order"}
          </span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <Command>
          <CommandInput placeholder="Search by order number or customer" />
          <CommandList>
            <CommandEmpty>No confirmed sales orders found.</CommandEmpty>
            <CommandGroup>
              {options.map((order) => (
                <CommandItem
                  key={order.id}
                  value={`${order.so_number} ${order.customer_name} ${order.id}`}
                  data-checked={order.id === selected?.id}
                  onSelect={() => {
                    setIsOpen(false)
                    router.replace(newDespatchForOrderRoute(order.id))
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{order.so_number}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {order.customer_name} • {formatDay(order.order_date)}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
