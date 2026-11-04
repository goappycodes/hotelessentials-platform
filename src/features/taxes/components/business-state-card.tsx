"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setBusinessState } from "@/actions/organization"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { INDIAN_STATES } from "@/constants/customers"

const NOT_SET = "__none__"

// Settings → Taxes: the business's GST state. Quotations to the same state use CGST +
// SGST, to other states IGST.
export function BusinessStateCard({ stateCode }: { stateCode: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(stateCode ?? NOT_SET)
  const [isPending, startTransition] = useTransition()
  const changed = value !== (stateCode ?? NOT_SET)

  function save() {
    startTransition(async () => {
      const result = await setBusinessState(value === NOT_SET ? "" : value)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Business GST state saved.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business GST state</CardTitle>
        <CardDescription>
          Where your business is GST-registered. Quotations to customers in this state use CGST
          + SGST; to other states, IGST.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Select value={value} onValueChange={setValue} disabled={isPending}>
          <SelectTrigger aria-label="Business GST state" className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOT_SET}>Not set</SelectItem>
            {INDIAN_STATES.map((state) => (
              <SelectItem key={state.code} value={state.code}>
                [{state.short}] {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={save} disabled={!changed || isPending}>
          {isPending && <Spinner />}
          Save
        </Button>
      </CardContent>
    </Card>
  )
}
