"use client"

import {
  ChevronDown,
  Ellipsis,
  FileX,
  Paperclip,
  Pencil,
  Printer,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteQuotation, setQuotationStatus } from "@/actions/quotations"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { quotationEditRoute, quotationPrintRoute } from "@/constants/routes"
import { QuotationDocument } from "@/features/quotations/components/quotation-document"
import { isQuotationExpired } from "@/features/quotations/components/quotation-status-badge"
import { STATUS_ACTIONS } from "@/features/quotations/list-config"
import {
  invalidateQuotationDetail,
  loadQuotationDetail,
} from "@/features/quotations/quotation-detail-cache"
import { todayInIndia } from "@/features/quotations/quotation-input"
import type { QuotationDocumentData } from "@/features/quotations/queries"
import type { Enums } from "@/types/database"

type Loaded = { id: string; data: QuotationDocumentData | null; failed: boolean }

// The opened quotation beside the list, like Zoho's quote view: Edit, Status, PDF/Print
// and Delete above the quote as the customer sees it. Loads in the browser, so opening a
// quotation never leaves the Quotations page.
export function QuotationPanel({
  quotationId,
  previewTitle,
  canEdit,
  canDelete,
  onClose,
  onListChange,
}: {
  quotationId: string
  // Shown straight away from the list while the quotation loads.
  previewTitle?: string
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  // The list beside the panel needs reloading (status changed, quotation deleted).
  onListChange: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadQuotationDetail(quotationId)
      .then((data) => {
        if (!cancelled) setLoaded({ id: quotationId, data, failed: false })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: quotationId, data: null, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [quotationId, version])

  // After an action: reload this quotation and the list beside it.
  const reload = useCallback(() => {
    invalidateQuotationDetail(quotationId)
    setVersion((value) => value + 1)
    onListChange()
  }, [quotationId, onListChange])

  // Until this quotation has loaded, show its skeleton (not the previously opened one).
  if (!loaded || loaded.id !== quotationId) {
    return <QuotationPanelSkeleton title={previewTitle} onClose={onClose} />
  }

  if (!loaded.data) {
    return (
      <StatusMessage
        icon={FileX}
        title={loaded.failed ? "Couldn't load this quotation" : "This quotation doesn't exist"}
        description={
          loaded.failed
            ? "Please try again."
            : "It may have been deleted, or you may not have access to it."
        }
      >
        <Button variant="outline" onClick={loaded.failed ? reload : onClose}>
          {loaded.failed ? "Try again" : "Back to quotations"}
        </Button>
      </StatusMessage>
    )
  }

  const data = loaded.data
  return (
    <QuotationView
      data={data}
      canEdit={canEdit}
      canDelete={canDelete}
      onClose={onClose}
      onChanged={reload}
      onDeleted={() => {
        invalidateQuotationDetail(quotationId)
        onListChange()
        onClose()
      }}
    />
  )
}

function QuotationView({
  data,
  canEdit,
  canDelete,
  onClose,
  onChanged,
  onDeleted,
}: {
  data: QuotationDocumentData
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const { quote, attachments } = data
  const [isPending, startTransition] = useTransition()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const isExpired = isQuotationExpired(quote, todayInIndia())

  function changeStatus(status: Enums<"quotation_status">, done: string) {
    startTransition(async () => {
      const result = await setQuotationStatus(quote.id, status)
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
      const result = await deleteQuotation(quote.id)
      if (!result.success) {
        toast.error(result.error)
        setIsConfirmingDelete(false)
        return
      }
      toast.success("Quotation deleted.")
      setIsConfirmingDelete(false)
      onDeleted()
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-6">
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{quote.quote_number}</h1>
        {isPending && <Spinner className="text-muted-foreground" />}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" aria-label={`Attachments (${attachments.length})`}>
              <Paperclip />
              {attachments.length > 0 && attachments.length}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <p className="px-1 pb-1 text-sm font-medium">Attachments</p>
            {attachments.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">No files attached.</p>
            ) : (
              <ul className="flex flex-col">
                {attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.url}
                      className="block truncate rounded-sm px-1 py-1.5 text-sm text-primary hover:bg-muted"
                    >
                      {file.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b bg-card px-4 py-1.5">
        {canEdit && (
          <Button asChild variant="ghost" size="sm">
            <Link href={quotationEditRoute(quote.id)}>
              <Pencil />
              Edit
            </Link>
          </Button>
        )}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isPending}>
                Status
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {STATUS_ACTIONS?.filter((action) => action.status !== quote.status).map((action) => (
                <DropdownMenuItem
                  key={action.status}
                  onSelect={() => changeStatus(action.status, action.done)}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button asChild variant="ghost" size="sm">
          <a href={quotationPrintRoute(quote.id)} target="_blank" rel="noreferrer">
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
        {quote.status === "Draft" && canEdit && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
            <Sparkles className="size-4 text-primary" />
            <p className="flex-1">
              <span className="font-semibold">WHAT&apos;S NEXT?</span> Send this quote to your
              customer, then mark it as sent.
            </p>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => changeStatus("Sent", "Quotation marked as sent.")}
            >
              Mark As Sent
            </Button>
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <QuotationDocument data={data} isExpired={isExpired} className="min-w-[44rem]" />
        </div>
      </div>

      <AlertDialog
        open={isConfirmingDelete}
        onOpenChange={(open) => !isPending && setIsConfirmingDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {quote.quote_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The quotation, its items and attached files are deleted for good.
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

export function QuotationPanelSkeleton({
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
        <Skeleton className="h-8 w-10" />
        {onClose && (
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
      <div className="flex gap-2 border-b bg-card px-4 py-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="flex-1 bg-muted/40 p-6">
        <QuotationDocumentSkeleton />
      </div>
    </div>
  )
}

export function QuotationDocumentSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-4 rounded-lg border bg-card p-8">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3 w-64" />
      <Skeleton className="h-3 w-56" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-[1fr_16rem] gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}
