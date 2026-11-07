"use client"

import { ChevronDown, X } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  deleteItems,
  setItemsActive,
  trackItemsInventory,
  type BulkItemsResult,
} from "@/actions/items"
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
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { invalidateItemDetail } from "@/features/items/item-detail-cache"
import type { ActionResult } from "@/types/actions"

type ItemsBulkActionsProps = {
  selectedIds: string[]
  canEdit: boolean
  canDelete: boolean
  onClear: () => void
  // After a change, so the list reloads.
  onChanged: () => void
}

const plural = (count: number) => (count === 1 ? "item" : "items")

// Zoho's bar for the items picked with the list checkboxes. Esc clears the selection.
export function ItemsBulkActions({
  selectedIds,
  canEdit,
  canDelete,
  onClear,
  onChanged,
}: ItemsBulkActionsProps) {
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

  function run(action: () => Promise<ActionResult<BulkItemsResult>>, done: (changed: number) => string) {
    startTransition(async () => {
      const result = await action()
      setIsConfirmingDelete(false)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      for (const id of selectedIds) invalidateItemDetail(id)
      const { changed, skipped, skippedReason } = result.data
      if (changed) toast.success(done(changed))
      if (skipped) {
        toast.error(`${skipped} ${plural(skipped)} skipped. ${skippedReason ?? ""}`.trim())
      }
      // In the same transition as the list reload, so the bar (with its spinner) stays
      // until the updated list shows, instead of the old statuses flashing back.
      startTransition(() => {
        onClear()
        onChanged()
      })
    })
  }

  return (
    <div
      role="toolbar"
      aria-label="Selected items"
      // Pinned just under the app header (h-14) while the list scrolls; above the rows'
      // checkboxes (z-1), below the header and its search dropdown (z-10).
      className="sticky top-14 z-5 flex min-h-12 flex-wrap items-center gap-2 rounded-lg rounded-t-none border border-t-0 bg-card px-3 py-2"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A span keeps the tooltip working on a disabled button. */}
          <span tabIndex={0}>
            <Button variant="outline" size="sm" disabled>
              Bulk Update
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Coming soon: change one field on all selected items.</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button variant="outline" size="sm" disabled>
              New Transaction
              <ChevronDown />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Available once quotations and sales orders are built.</TooltipContent>
      </Tooltip>
      {canEdit && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(
                () => setItemsActive(selectedIds, true),
                (changed) => `${changed} ${plural(changed)} marked as active.`
              )
            }
          >
            Mark as Active
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(
                () => setItemsActive(selectedIds, false),
                (changed) => `${changed} ${plural(changed)} marked as inactive.`
              )
            }
          >
            Mark as Inactive
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(
                () => trackItemsInventory(selectedIds),
                (changed) =>
                  `${changed} ${plural(changed)} now tracking inventory. Add their stock with an adjustment.`
              )
            }
          >
            Track Inventory
          </Button>
        </>
      )}
      {canDelete && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setIsConfirmingDelete(true)}
        >
          Delete
        </Button>
      )}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <span className="flex items-center gap-2 text-sm">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary tabular-nums">
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
              The items and their images are deleted for good. Locked items and items used in
              a price list are skipped; mark them as inactive instead.
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
                  () => deleteItems(selectedIds),
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
