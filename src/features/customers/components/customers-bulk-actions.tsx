"use client"

import { Ellipsis, Mail, Printer, X } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  deleteCustomers,
  setCustomersActive,
  type BulkCustomersResult,
} from "@/actions/customers"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ActionResult } from "@/types/actions"

type CustomersBulkActionsProps = {
  selectedIds: string[]
  canEdit: boolean
  canDelete: boolean
  onClear: () => void
  // After a change, so the list reloads.
  onChanged: () => void
}

const plural = (count: number) => (count === 1 ? "customer" : "customers")

// A button that isn't available yet, with a tooltip saying why.
function ComingSoon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A span keeps the tooltip working on a disabled button. */}
        <span tabIndex={0}>{children}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Zoho's bar for the customers picked with the list checkboxes. Esc clears the selection.
export function CustomersBulkActions({
  selectedIds,
  canEdit,
  canDelete,
  onClear,
  onChanged,
}: CustomersBulkActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const count = selectedIds.length

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // The delete dialog handles Esc itself.
      if (event.key === "Escape" && !isConfirmingDelete && !isPending) onClear()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isConfirmingDelete, isPending, onClear])

  function run(
    action: () => Promise<ActionResult<BulkCustomersResult>>,
    done: (changed: number) => string
  ) {
    startTransition(async () => {
      const result = await action()
      setIsConfirmingDelete(false)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(done(result.data.changed))
      // In the same transition as the list reload, so the bar (with its spinner) stays
      // until the updated list shows.
      startTransition(() => {
        onClear()
        onChanged()
      })
    })
  }

  return (
    <div
      role="toolbar"
      aria-label="Selected customers"
      className="sticky top-14 z-5 flex min-h-12 flex-wrap items-center gap-2 rounded-t-none border-t-0 rounded-lg border bg-card px-3 py-2 shadow-sm"
    >
      <ComingSoon label="Coming soon: change one field on all selected customers.">
        <Button variant="outline" size="sm" disabled>
          Bulk Update
        </Button>
      </ComingSoon>
      <ButtonGroup>
        <ComingSoon label="Coming soon: email the selected customers.">
          <Button variant="outline" size="icon-sm" disabled aria-label="Email">
            <Mail />
          </Button>
        </ComingSoon>
        <ComingSoon label="Coming soon: print the selected customers.">
          <Button variant="outline" size="icon-sm" disabled aria-label="Print">
            <Printer />
          </Button>
        </ComingSoon>
      </ButtonGroup>
      <Separator orientation="vertical" className="mx-1 h-5" />
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(
              () => setCustomersActive(selectedIds, false),
              (changed) => `${changed} ${plural(changed)} marked as inactive.`
            )
          }
        >
          Mark as Inactive
        </Button>
      )}
      <ComingSoon label="Coming soon: combine duplicate customers into one.">
        <Button variant="outline" size="sm" disabled>
          Merge
        </Button>
      </ComingSoon>
      <ComingSoon label="Coming soon: available once invoice templates exist.">
        <Button variant="outline" size="sm" disabled>
          Associate Templates
        </Button>
      </ComingSoon>
      {(canEdit || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" disabled={isPending} aria-label="More actions">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {canEdit && (
              <DropdownMenuItem
                onSelect={() =>
                  run(
                    () => setCustomersActive(selectedIds, true),
                    (changed) => `${changed} ${plural(changed)} marked as active.`
                  )
                }
              >
                Mark as Active
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onSelect={() => setIsConfirmingDelete(true)}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <span className="flex items-center gap-2 text-sm">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary tabular-nums">
          {count}
        </span>
        Selected
      </span>
      {isPending && <Spinner className="text-muted-foreground" />}
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground"
        onClick={onClear}
        disabled={isPending}
        aria-label="Clear selection"
      >
        <Kbd>Esc</Kbd>
        <X className="text-destructive" />
      </Button>

      <AlertDialog
        open={isConfirmingDelete}
        onOpenChange={(open) => !isPending && setIsConfirmingDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {count} {plural(count)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The customers and their contact persons are deleted for good. To keep them for
              your records, mark them as inactive instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                // Stay open until the delete finishes.
                event.preventDefault()
                run(
                  () => deleteCustomers(selectedIds),
                  (changed) => `${changed} ${plural(changed)} deleted.`
                )
              }}
            >
              {isPending && <Spinner />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
