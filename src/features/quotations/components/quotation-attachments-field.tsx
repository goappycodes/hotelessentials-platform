"use client"

import { FileText, Paperclip, Upload, X } from "lucide-react"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { addQuotationAttachments, removeQuotationAttachment } from "@/actions/quotations"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  MAX_QUOTATION_ATTACHMENT_BYTES,
  MAX_QUOTATION_ATTACHMENTS,
  QUOTATION_ATTACHMENT_ACCEPT,
  QUOTATION_ATTACHMENT_TYPES,
  QUOTATION_ATTACHMENTS_BUCKET,
} from "@/constants/quotations"
import { AttachmentLink } from "@/features/quotations/components/attachment-viewer"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export type QuotationAttachmentView = {
  id: string
  fileName: string
  fileSize: number | null
  contentType: string | null
  // Shows the file; the download link saves it by name.
  url: string
  downloadUrl: string
}

export type PendingAttachment = { id: string; file: File }

// Types the browser leaves blank or reports oddly, by extension.
const TYPE_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  txt: "text/plain",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

function contentTypeOf(file: File) {
  if (QUOTATION_ATTACHMENT_TYPES.includes(file.type)) return file.type
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  return TYPE_BY_EXTENSION[extension] ?? null
}

function formatSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type QuotationAttachmentsFieldProps = {
  existing: QuotationAttachmentView[]
  onExistingChange: (files: QuotationAttachmentView[]) => void
  pending: PendingAttachment[]
  onPendingChange: (files: PendingAttachment[]) => void
  // Saved files can be removed (edit access).
  canRemove: boolean
  disabled: boolean
}

// Zoho's "Attach File(s) to Quote". New files are kept in the browser until the
// quotation is saved (see uploadQuotationAttachments); removing a saved file deletes it
// straight away.
export function QuotationAttachmentsField({
  existing,
  onExistingChange,
  pending,
  onPendingChange,
  canRemove,
  disabled,
}: QuotationAttachmentsFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isRemoving, startRemoving] = useTransition()
  const [removingId, setRemovingId] = useState<string>()
  const remaining = MAX_QUOTATION_ATTACHMENTS - existing.length - pending.length
  const canAdd = !disabled && remaining > 0

  function handleFiles(files: FileList | null) {
    if (!files) return
    const accepted: PendingAttachment[] = []
    for (const file of Array.from(files)) {
      if (!contentTypeOf(file)) {
        toast.error(`${file.name} isn't a PDF, image, Word, Excel, CSV or text file.`)
      } else if (file.size > MAX_QUOTATION_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is larger than 10 MB.`)
      } else if (file.size === 0) {
        toast.error(`${file.name} is empty.`)
      } else if (accepted.length >= remaining) {
        toast.error(`A quotation can have at most ${MAX_QUOTATION_ATTACHMENTS} files.`)
        break
      } else {
        accepted.push({ id: crypto.randomUUID(), file })
      }
    }
    if (accepted.length) onPendingChange([...pending, ...accepted])
    if (inputRef.current) inputRef.current.value = ""
  }

  function removeExisting(file: QuotationAttachmentView) {
    setRemovingId(file.id)
    startRemoving(async () => {
      const result = await removeQuotationAttachment(file.id)
      setRemovingId(undefined)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      onExistingChange(existing.filter((entry) => entry.id !== file.id))
    })
  }

  const hasFiles = existing.length + pending.length > 0

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Attach File(s) to Quote</p>
      {!disabled && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAdd}
            onClick={() => inputRef.current?.click()}
            className="border-dashed bg-background"
          >
            <Upload />
            Upload File
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={QUOTATION_ATTACHMENT_ACCEPT}
            multiple
            hidden
            onChange={(event) => handleFiles(event.target.files)}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        You can upload a maximum of {MAX_QUOTATION_ATTACHMENTS} files, 10MB each
      </p>
      {hasFiles ? (
        <ul className="flex flex-col gap-1.5">
          {existing.map((file) => (
            <FileRow
              key={file.id}
              name={file.fileName}
              size={formatSize(file.fileSize)}
              saved={file}
              isRemoving={isRemoving && removingId === file.id}
              onRemove={canRemove && !disabled ? () => removeExisting(file) : undefined}
            />
          ))}
          {pending.map((file) => (
            <FileRow
              key={file.id}
              name={file.file.name}
              size={`${formatSize(file.file.size)} · uploads when saved`}
              onRemove={
                disabled
                  ? undefined
                  : () => onPendingChange(pending.filter((entry) => entry.id !== file.id))
              }
            />
          ))}
        </ul>
      ) : (
        disabled && <p className="text-sm text-muted-foreground">No files attached.</p>
      )}
    </div>
  )
}

function FileRow({
  name,
  size,
  saved,
  isRemoving,
  onRemove,
}: {
  name: string
  size: string
  // A file already uploaded, which can be opened.
  saved?: QuotationAttachmentView
  isRemoving?: boolean
  onRemove?: () => void
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-sm">
      {saved ? (
        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        {saved ? (
          <AttachmentLink
            file={saved}
            className="block max-w-full truncate text-left text-primary hover:underline"
          />
        ) : (
          <span className="block truncate">{name}</span>
        )}
        {size && <span className="block text-xs text-muted-foreground">{size}</span>}
      </span>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${name}`}
          disabled={isRemoving}
          onClick={onRemove}
          className={cn("shrink-0", isRemoving && "opacity-100")}
        >
          {isRemoving ? <Spinner /> : <X />}
        </Button>
      )}
    </li>
  )
}

// Uploads files to storage under `<quotationId>/` and records them. Uploaded files are
// removed again if they can't be recorded.
export async function uploadQuotationAttachments(quotationId: string, files: PendingAttachment[]) {
  const supabase = createClient()
  const uploaded: Parameters<typeof addQuotationAttachments>[1] = []

  try {
    for (const { file } of files) {
      const contentType = contentTypeOf(file) ?? "application/octet-stream"
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
      const storagePath = `${quotationId}/${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage
        .from(QUOTATION_ATTACHMENTS_BUCKET)
        .upload(storagePath, file, { contentType })
      if (error) throw error
      uploaded.push({
        storagePath,
        fileName: file.name.slice(0, 200),
        contentType,
        fileSize: file.size,
      })
    }

    const result = await addQuotationAttachments(quotationId, uploaded)
    if (!result.success) throw new Error(result.error)
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage
        .from(QUOTATION_ATTACHMENTS_BUCKET)
        .remove(uploaded.map((file) => file.storagePath))
    }
    throw error
  }
}
