"use client"

import { Download, ExternalLink, FileText } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { QuotationAttachmentView } from "@/features/quotations/components/quotation-attachments-field"

type ViewerKind = "image" | "pdf" | "text" | "none"

function viewerKind(contentType: string | null): ViewerKind {
  if (contentType?.startsWith("image/")) return "image"
  if (contentType === "application/pdf") return "pdf"
  if (contentType === "text/plain" || contentType === "text/csv") return "text"
  return "none"
}

// A file's name that opens it in a window over the page, so viewing never leaves the
// quotation. Browsers can't show Word or Excel files, so those offer the download.
export function AttachmentLink({
  file,
  className,
}: {
  file: QuotationAttachmentView
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={className}>
        {file.fileName}
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-4xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="truncate">{file.fileName}</DialogTitle>
            <DialogDescription className="sr-only">
              Attached to this quotation.
            </DialogDescription>
          </DialogHeader>
          {/* Loaded only once opened, so a closed file costs nothing. */}
          {isOpen && <AttachmentBody file={file} />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={file.url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open in New Tab
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={file.downloadUrl}>
                <Download />
                Download
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AttachmentBody({ file }: { file: QuotationAttachmentView }) {
  const kind = viewerKind(file.contentType)

  if (kind === "image") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border bg-muted/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage URL of any size */}
        <img src={file.url} alt={file.fileName} className="max-h-[70svh] object-contain" />
      </div>
    )
  }
  if (kind === "pdf") {
    return (
      <iframe
        src={file.url}
        title={file.fileName}
        className="h-[70svh] w-full rounded-lg border bg-muted/40"
      />
    )
  }
  if (kind === "text") return <TextPreview url={file.url} />

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/40 px-6 py-12 text-center">
      <FileText className="size-8 text-muted-foreground" />
      <p className="font-medium">This file can&apos;t be shown here</p>
      <p className="text-muted-foreground">Download it to open it in Word or Excel.</p>
    </div>
  )
}

function TextPreview({ url }: { url: string }) {
  const [result, setResult] = useState<{ text: string } | { failed: true } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load the file")
        return response.text()
      })
      .then((text) => {
        if (!cancelled) setResult({ text })
      })
      .catch(() => {
        if (!cancelled) setResult({ failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (!result) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2 rounded-lg border p-4">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }
  if ("failed" in result) {
    return (
      <p className="rounded-lg border bg-muted/40 px-4 py-8 text-center text-muted-foreground">
        Couldn&apos;t load this file. Try downloading it instead.
      </p>
    )
  }
  return (
    <pre className="max-h-[70svh] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs whitespace-pre-wrap">
      {result.text}
    </pre>
  )
}
