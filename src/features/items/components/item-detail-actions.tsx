"use client"

import { ChevronDown, Pencil, X } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteItem, setItemActive, setItemLocked } from "@/actions/items"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ROUTES, itemEditRoute } from "@/constants/routes"

type ItemDetailActionsProps = {
  itemId: string
  itemName: string
  isActive: boolean
  isLocked: boolean
  can: { create: boolean; edit: boolean; delete: boolean; lock: boolean }
  // After a change, so the panel and list can reload.
  onChanged: () => void
  onDeleted: () => void
  onClose: () => void
}

export function ItemDetailActions({
  itemId,
  itemName,
  isActive,
  isLocked,
  can,
  onChanged,
  onDeleted,
  onClose,
}: ItemDetailActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const canChange = !isLocked

  function run(action: () => Promise<{ success: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong. Please try again.")
        return
      }
      toast.success(done)
      onChanged()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteItem(itemId)
      if (!result.success) {
        toast.error(result.error)
        setIsConfirmingDelete(false)
        return
      }
      toast.success("Item deleted.")
      setIsConfirmingDelete(false)
      onDeleted()
    })
  }

  const showMore = can.create || (can.edit && canChange) || (can.delete && canChange) || can.lock

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isPending && <Spinner className="text-muted-foreground" />}
      {can.edit && canChange && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="outline" size="icon-sm" aria-label="Edit item">
              <Link href={itemEditRoute(itemId)}>
                <Pencil />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A span keeps the tooltip working on a disabled button. */}
          <span tabIndex={0}>
            <Button size="sm" disabled>
              Adjust Stock
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Stock adjustments arrive with the Inventory module.</TooltipContent>
      </Tooltip>
      {showMore && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              More
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {can.create && (
              <DropdownMenuItem asChild>
                <Link href={`${ROUTES.itemsAdd}?clone=${itemId}`}>Clone Item</Link>
              </DropdownMenuItem>
            )}
            {can.edit && canChange && (
              <DropdownMenuItem
                onSelect={() =>
                  run(
                    () => setItemActive(itemId, !isActive),
                    isActive ? "Item marked as inactive." : "Item marked as active."
                  )
                }
              >
                {isActive ? "Mark as Inactive" : "Mark as Active"}
              </DropdownMenuItem>
            )}
            {can.delete && canChange && (
              <DropdownMenuItem variant="destructive" onSelect={() => setIsConfirmingDelete(true)}>
                Delete
              </DropdownMenuItem>
            )}
            {can.lock && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => setItemLocked(itemId, !isLocked),
                      isLocked ? "Item unlocked." : "Item locked."
                    )
                  }
                >
                  {isLocked ? "Unlock item" : "Lock item"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
        <X />
      </Button>

      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
            <AlertDialogDescription>
              The item and its images are deleted for good. Items used in a price list
              can&apos;t be deleted; mark them as inactive instead.
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
                handleDelete()
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
