"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteInventoryAdjustment } from "@/actions/inventory-adjustments"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { AdjustmentStatus } from "@/constants/inventory"
import { ROUTES } from "@/constants/routes"
import { invalidateItemDetail } from "@/features/items/item-detail-cache"

export function DeleteAdjustmentButton({
  adjustmentId,
  status,
  itemIds,
}: {
  adjustmentId: string
  status: AdjustmentStatus
  // Items whose stock changes when an adjusted adjustment is deleted.
  itemIds: string[]
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteInventoryAdjustment(adjustmentId)
      if (!result.success) {
        toast.error(result.error)
        setIsOpen(false)
        return
      }
      for (const itemId of itemIds) invalidateItemDetail(itemId)
      toast.success("Adjustment deleted.")
      router.push(ROUTES.inventoryAdjustments)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !isPending && setIsOpen(open)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this adjustment?</AlertDialogTitle>
          <AlertDialogDescription>
            {status === "Adjusted"
              ? "Its stock changes are reversed. This can't be undone."
              : "The draft is deleted for good."}
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
  )
}
