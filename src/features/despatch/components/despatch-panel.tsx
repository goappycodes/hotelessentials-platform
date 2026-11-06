"use client"

import {
  ChevronDown,
  ClipboardList,
  Ellipsis,
  FileX,
  Pencil,
  Printer,
  Trash2,
  X,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteDespatch, setDespatchStatus } from "@/actions/despatch"
import { StatusMessage } from "@/components/shared/status-message"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { despatchPrintRoute, salesOrderRoute } from "@/constants/routes"
import { DespatchDetailsDialog } from "@/features/despatch/components/despatch-details-dialog"
import { DespatchDocument } from "@/features/despatch/components/despatch-document"
import {
  invalidateDespatchDetail,
  loadDespatchDetail,
} from "@/features/despatch/despatch-detail-cache"
import { DESPATCH_STATUS_ACTIONS } from "@/features/despatch/list-config"
import type { DespatchDocumentData } from "@/features/despatch/queries"
import { QuotationDocumentSkeleton } from "@/features/quotations/components/quotation-panel"
import type { Enums } from "@/types/database"

type Loaded = { id: string; data: DespatchDocumentData | null; failed: boolean }

// The opened despatch beside the list: Status, Transport Details, PDF/Print and Delete above
// the note. Loads in the browser, so opening one never leaves the Despatch page.
export function DespatchPanel({
  despatchId,
  previewTitle,
  canEdit,
  canDelete,
  canViewSalesOrders,
  onClose,
  onListChange,
}: {
  despatchId: string
  // Shown straight away from the list while the despatch loads.
  previewTitle?: string
  canEdit: boolean
  canDelete: boolean
  canViewSalesOrders: boolean
  onClose: () => void
  // The list beside the panel needs reloading (status changed, despatch deleted).
  onListChange: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadDespatchDetail(despatchId)
      .then((data) => {
        if (!cancelled) setLoaded({ id: despatchId, data, failed: false })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: despatchId, data: null, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [despatchId, version])

  // After an action: reload this despatch and the list beside it.
  const reload = useCallback(() => {
    invalidateDespatchDetail(despatchId)
    setVersion((value) => value + 1)
    onListChange()
  }, [despatchId, onListChange])

  // Until this despatch has loaded, show its skeleton (not the previously opened one).
  if (!loaded || loaded.id !== despatchId) {
    return <DespatchPanelSkeleton title={previewTitle} onClose={onClose} />
  }

  if (!loaded.data) {
    return (
      <StatusMessage
        icon={FileX}
        title={loaded.failed ? "Couldn't load this despatch" : "This despatch doesn't exist"}
        description={
          loaded.failed
            ? "Please try again."
            : "It may have been deleted, or you may not have access to it."
        }
      >
        <Button variant="outline" onClick={loaded.failed ? reload : onClose}>
          {loaded.failed ? "Try again" : "Back to despatches"}
        </Button>
      </StatusMessage>
    )
  }

  return (
    <DespatchView
      data={loaded.data}
      canEdit={canEdit}
      canDelete={canDelete}
      canViewSalesOrders={canViewSalesOrders}
      onClose={onClose}
      onChanged={reload}
      onDeleted={() => {
        invalidateDespatchDetail(despatchId)
        onListChange()
        onClose()
      }}
    />
  )
}

function DespatchView({
  data,
  canEdit,
  canDelete,
  canViewSalesOrders,
  onClose,
  onChanged,
  onDeleted,
}: {
  data: DespatchDocumentData
  canEdit: boolean
  canDelete: boolean
  canViewSalesOrders: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const { despatch } = data
  const [isPending, startTransition] = useTransition()
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  // Goods that have left stay on record, so only packed despatches can be deleted.
  const showDelete = canDelete && despatch.status === "Packed"

  function changeStatus(status: Enums<"despatch_status">, done: string) {
    startTransition(async () => {
      const result = await setDespatchStatus(despatch.id, status)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(done)
      onChanged()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDespatch(despatch.id)
      if (!result.success) {
        toast.error(result.error)
        setIsConfirmingDelete(false)
        return
      }
      toast.success("Despatch deleted.")
      setIsConfirmingDelete(false)
      onDeleted()
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-6">
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{despatch.despatch_number}</h1>
        {isPending && <Spinner className="text-muted-foreground" />}
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b bg-card px-4 py-1.5">
        {canEdit && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isPending}>
                  Status
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {DESPATCH_STATUS_ACTIONS.filter((action) => action.status !== despatch.status).map(
                  (action) => (
                    <DropdownMenuItem
                      key={action.status}
                      onSelect={() => changeStatus(action.status, action.done)}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setIsEditingDetails(true)}
            >
              <Pencil />
              Transport Details
            </Button>
          </>
        )}
        <Button asChild variant="ghost" size="sm">
          <a href={despatchPrintRoute(despatch.id)} target="_blank" rel="noreferrer">
            <Printer />
            PDF/Print
          </a>
        </Button>
        {showDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More actions" disabled={isPending}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem variant="destructive" onSelect={() => setIsConfirmingDelete(true)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 bg-muted/40 p-4 sm:p-6">
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
          <ClipboardList className="size-4 shrink-0 text-primary" />
          <p>
            For sales order{" "}
            {canViewSalesOrders ? (
              <Link
                href={salesOrderRoute(despatch.sales_order_id)}
                className="font-medium text-primary hover:underline"
              >
                {despatch.so_number}
              </Link>
            ) : (
              <span className="font-medium">{despatch.so_number}</span>
            )}
            .
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <DespatchDocument data={data} className="min-w-[595.28pt]" />
        </div>
      </div>

      {isEditingDetails && (
        <DespatchDetailsDialog
          despatch={despatch}
          open
          onOpenChange={setIsEditingDetails}
          onSaved={onChanged}
        />
      )}

      <AlertDialog
        open={isConfirmingDelete}
        onOpenChange={(open) => !isPending && setIsConfirmingDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {despatch.despatch_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The despatch is deleted for good, and its quantities go back to {despatch.so_number}{" "}
              to be packed again.
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

export function DespatchPanelSkeleton({
  title,
  onClose,
}: {
  title?: string
  onClose?: () => void
}) {
  return (
    <div aria-busy="true" className="flex min-h-full flex-col">
      <span className="sr-only">Loading…</span>
      <div className="flex h-14 items-center gap-2 border-b bg-card px-6">
        {title ? (
          <p className="flex-1 truncate text-xl font-semibold">{title}</p>
        ) : (
          <Skeleton className="h-6 w-32 flex-1" />
        )}
        {onClose && (
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
      <div className="flex gap-2 border-b bg-card px-4 py-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="flex flex-1 flex-col gap-4 bg-muted/40 p-6">
        <Skeleton className="h-11 w-full rounded-lg" />
        <QuotationDocumentSkeleton />
      </div>
    </div>
  )
}
