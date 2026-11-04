"use client"

import { Ellipsis, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setDirectTaxActive, type DirectTaxRate } from "@/actions/direct-taxes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DirectTaxDialog } from "@/features/direct-taxes/components/direct-tax-dialog"
import type { Enums } from "@/types/database"

type Kind = Enums<"direct_tax_kind">

const HEAD_CLASS = "h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"

const DESCRIPTIONS: Record<Kind, string> = {
  TDS: "Tax deducted at source. Picked under the sub total of a quotation and taken off its total.",
  TCS: "Tax collected at source. Picked under the sub total of a quotation and added to its total.",
}

// Settings → Direct Taxes: the TDS and TCS rates quotations pick from, like Zoho's
// TDS Rates and TCS Rates.
export function DirectTaxesManager({
  rates,
  canEdit,
}: {
  rates: DirectTaxRate[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ kind: Kind; rate?: DirectTaxRate } | null>(null)
  const [isPending, startTransition] = useTransition()

  function setActive(rate: DirectTaxRate, isActive: boolean) {
    startTransition(async () => {
      const result = await setDirectTaxActive(rate.id, isActive)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(isActive ? `${rate.name} is active again.` : `${rate.name} marked as inactive.`)
      router.refresh()
    })
  }

  return (
    <>
      <Tabs defaultValue="TDS" className="gap-4">
        <TabsList>
          <TabsTrigger value="TDS">TDS Rates</TabsTrigger>
          <TabsTrigger value="TCS">TCS Rates</TabsTrigger>
        </TabsList>
        {(["TDS", "TCS"] as const).map((kind) => {
          const rows = rates.filter((rate) => rate.kind === kind)
          return (
            <TabsContent key={kind} value={kind}>
              <Card className="gap-0 overflow-hidden py-0">
                <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                  <p className="flex-1 text-sm text-muted-foreground">{DESCRIPTIONS[kind]}</p>
                  {canEdit && (
                    <Button size="sm" onClick={() => setDialog({ kind })}>
                      <Plus />
                      New {kind} Tax
                    </Button>
                  )}
                </div>
                {rows.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No {kind} rates yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className={HEAD_CLASS}>Tax Name</TableHead>
                        <TableHead className={`${HEAD_CLASS} text-right`}>Rate (%)</TableHead>
                        <TableHead className={HEAD_CLASS}>Status</TableHead>
                        {canEdit && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((rate) => (
                        <TableRow key={rate.id}>
                          <TableCell className="px-4 py-3 font-medium">{rate.name}</TableCell>
                          <TableCell className="px-4 text-right tabular-nums">
                            {Number(rate.rate.toFixed(2))}
                          </TableCell>
                          <TableCell className="px-4">
                            {rate.is_active ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          {canEdit && (
                            <TableCell className="px-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${rate.name}`}
                                    disabled={isPending}
                                  >
                                    <Ellipsis />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onSelect={() => setDialog({ kind, rate })}>
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setActive(rate, !rate.is_active)}>
                                    {rate.is_active ? "Mark as Inactive" : "Mark as Active"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>
      <DirectTaxDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        kind={dialog?.kind ?? "TDS"}
        rate={dialog?.rate}
        onSaved={() => router.refresh()}
      />
    </>
  )
}

export function DirectTaxesManagerSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-56" />
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-8 w-32" />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-4 py-3">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="ml-auto h-4 w-10" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  )
}
