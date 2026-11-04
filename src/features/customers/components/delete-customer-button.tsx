"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteCustomer } from "@/actions/customers"
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
import { ROUTES } from "@/constants/routes"

export function DeleteCustomerButton({ customerId, name }: { customerId: string; name: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCustomer(customerId)
      if (!result.success) {
        toast.error(result.error)
        setIsOpen(false)
        return
      }
      toast.success("Customer deleted.")
      router.push(ROUTES.customers)
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
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The customer and their contact persons are deleted for good. To keep them for your
            records, mark the customer as inactive instead.
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
