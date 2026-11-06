"use client"

import { ChevronDown, Ellipsis, FileText, FileX, Printer, Trash2, Truck, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteSalesOrder, setSalesOrderStatus } from "@/actions/sales-orders"
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
import {
  despatchRoute,
  newDespatchForOrderRoute,
  quotationRoute,
  salesOrderPrintRoute,
} from "@/constants/routes"
import { QuotationDocumentSkeleton } from "@/features/quotations/components/quotation-panel"
import { SalesOrderDocument } from "@/features/sales-orders/components/sales-order-document"
import { SALES_ORDER_STATUS_ACTIONS } from "@/features/sales-orders/list-config"
import type { SalesOrderDocumentData } from "@/features/sales-orders/queries"
import {
  invalidateSalesOrderDetail,
  loadSalesOrderDetail,
} from "@/features/sales-orders/sales-order-detail-cache"
import type { Enums } from "@/types/database"

type Loaded = { id: string; data: SalesOrderDocumentData | null; failed: boolean }

// The opened sales order beside the list: Status, PDF/Print and Delete above the order.
// Loads in the browser, so opening an order never leaves the Sales Orders page.
export function SalesOrderPanel({
  salesOrderId,
  previewTitle,
  canEdit,
  canDelete,
  canViewQuotations,
  canCreateDespatch,
  canViewDespatch,
  onClose,
  onListChange,
}: {
  salesOrderId: string
  // Shown straight away from the list while the order loads.
  previewTitle?: string
  canEdit: boolean
  canDelete: boolean
  canViewQuotations: boolean
  canCreateDespatch: boolean
  canViewDespatch: boolean
  onClose: () => void
  // The list beside the panel needs reloading (status changed, order deleted).
  onListChange: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadSalesOrderDetail(salesOrderId)
      .then((data) => {
        if (!cancelled) setLoaded({ id: salesOrderId, data, failed: false })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: salesOrderId, data: null, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [salesOrderId, version])

  // After an action: reload this order and the list beside it.
  const reload = useCallback(() => {
    invalidateSalesOrderDetail(salesOrderId)
    setVersion((value) => value + 1)
    onListChange()
  }, [salesOrderId, onListChange])

  // Until this order has loaded, show its skeleton (not the previously opened one).
  if (!loaded || loaded.id !== salesOrderId) {
    return <SalesOrderPanelSkeleton title={previewTitle} onClose={onClose} />
  }

  if (!loaded.data) {
    return (
      <StatusMessage
        icon={FileX}
        title={loaded.failed ? "Couldn't load this sales order" : "This sales order doesn't exist"}
        description={
          loaded.failed
            ? "Please try again."
            : "It may have been deleted, or you may not have access to it."
        }
      >
        <Button variant="outline" onClick={loaded.failed ? reload : onClose}>
          {loaded.failed ? "Try again" : "Back to sales orders"}
        </Button>
      </StatusMessage>
    )
  }

  return (
    <SalesOrderView
      data={loaded.data}
      canEdit={canEdit}
      canDelete={canDelete}
      canViewQuotations={canViewQuotations}
      canCreateDespatch={canCreateDespatch}
      canViewDespatch={canViewDespatch}
      onClose={onClose}
      onChanged={reload}
      onDeleted={() => {
        invalidateSalesOrderDetail(salesOrderId)
        onListChange()
        onClose()
      }}
    />
  )
}

function SalesOrderView({
  data,
  canEdit,
  canDelete,
  canViewQuotations,
  canCreateDespatch,
  canViewDespatch,
  onClose,
  onChanged,
  onDeleted,
}: {
  data: SalesOrderDocumentData
  canEdit: boolean
  canDelete: boolean
  canViewQuotations: boolean
  canCreateDespatch: boolean
  canViewDespatch: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const { order, despatches } = data
  const [isPending, startTransition] = useTransition()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  function changeStatus(status: Enums<"sales_order_status">, done: string) {
    startTransition(async () => {
      const result = await setSalesOrderStatus(order.id, status)
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
      const result = await deleteSalesOrder(order.id)
      if (!result.success) {
        toast.error(result.error)
        setIsConfirmingDelete(false)
        return
      }
      toast.success("Sales order deleted.")
      setIsConfirmingDelete(false)
      onDeleted()
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-6">
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{order.so_number}</h1>
        {isPending && <Spinner className="text-muted-foreground" />}
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b bg-card px-4 py-1.5">
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isPending}>
                Status
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {SALES_ORDER_STATUS_ACTIONS.filter((action) => action.status !== order.status).map(
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
        )}
        {canCreateDespatch && order.status === "Confirmed" && (
          <Button asChild variant="ghost" size="sm">
            <Link href={newDespatchForOrderRoute(order.id)}>
              <Truck />
              Despatch
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm">
          <a href={salesOrderPrintRoute(order.id)} target="_blank" rel="noreferrer">
            <Printer />
            PDF/Print
          </a>
        </Button>
        {canDelete && (
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
        {order.quote_number && (
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
            <FileText className="size-4 shrink-0 text-primary" />
            <p>
              Created from quotation{" "}
              {order.quotation_id && canViewQuotations ? (
                <Link
                  href={quotationRoute(order.quotation_id)}
                  className="font-medium text-primary hover:underline"
                >
                  {order.quote_number}
                </Link>
              ) : (
                <span className="font-medium">{order.quote_number}</span>
              )}
              {!order.quotation_id && " (since deleted)"}.
            </p>
          </div>
        )}
        {despatches.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
            <Truck className="mt-0.5 size-4 shrink-0 text-primary" />
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {despatches.map((despatch) => (
                <li key={despatch.id}>
                  {canViewDespatch ? (
                    <Link
                      href={despatchRoute(despatch.id)}
                      className="font-medium text-primary hover:underline"
                    >
                      {despatch.despatch_number}
                    </Link>
                  ) : (
                    <span className="font-medium">{despatch.despatch_number}</span>
                  )}{" "}
                  <span className="text-muted-foreground">{despatch.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <SalesOrderDocument data={data} className="min-w-[595.28pt]" />
        </div>
      </div>

      <AlertDialog
        open={isConfirmingDelete}
        onOpenChange={(open) => !isPending && setIsConfirmingDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {order.so_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The sales order and its items are deleted for good.
              {order.quote_number && ` Quotation ${order.quote_number} stays as it is.`}
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

export function SalesOrderPanelSkeleton({
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
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="flex flex-1 flex-col gap-4 bg-muted/40 p-6">
        <Skeleton className="h-11 w-full rounded-lg" />
        <QuotationDocumentSkeleton />
      </div>
    </div>
  )
}
