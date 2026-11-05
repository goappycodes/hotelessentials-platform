"use client"

import { Printer } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

// Above the printable quote (hidden when printing). Opens the print dialog once the page
// is ready; "Save as PDF" there gives the PDF, named after the page title, so the title
// becomes the quote number first.
export function PrintToolbar({ title }: { title: string }) {
  function print() {
    document.title = title
    window.print()
  }

  useEffect(() => {
    document.title = title
    const timer = setTimeout(() => {
      document.title = title
      window.print()
    }, 400)
    return () => clearTimeout(timer)
  }, [title])

  return (
    <div className="mx-auto flex w-full max-w-[210mm] items-center gap-3 py-4 print:hidden">
      <p className="flex-1 text-sm text-muted-foreground">
        {title} — choose <span className="font-medium text-foreground">Save as PDF</span> in the
        print dialog to download it.
      </p>
      <Button onClick={print}>
        <Printer />
        Print / Save as PDF
      </Button>
    </div>
  )
}
