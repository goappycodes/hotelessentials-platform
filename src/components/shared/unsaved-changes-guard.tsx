"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

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

type Leaving = { kind: "link"; href: string } | { kind: "back" }

// Asks before leaving a form with unsaved changes. The App Router can't block navigation,
// so each way out is caught here:
// - links (Cancel, the sidebar): caught before Next.js sees the click;
// - the browser's Back: an extra history entry takes the hit, and is put back until the
//   user decides;
// - closing or reloading the tab: the browser's own prompt.
// Saving navigates from code, so it passes straight through.
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const router = useRouter()
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  const hasExtraEntry = useRef(false)
  const hasConfirmed = useRef(false)

  useEffect(() => {
    if (!when) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      // Already said yes: don't ask again on the way out.
      if (!hasConfirmed.current) event.preventDefault()
    }

    function handleClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const link = event.target instanceof Element ? event.target.closest("a") : null
      if (!link?.href || link.hasAttribute("download")) return
      if (link.target && link.target !== "_self") return

      const url = new URL(link.href)
      const isOtherPage =
        url.origin === window.location.origin &&
        (url.pathname !== window.location.pathname || url.search !== window.location.search)
      if (!isOtherPage) return

      event.preventDefault()
      event.stopPropagation()
      setLeaving({ kind: "link", href: `${url.pathname}${url.search}${url.hash}` })
    }

    function handlePopState() {
      window.history.pushState(null, "", window.location.href)
      setLeaving({ kind: "back" })
    }

    // Once only: a failed save turns this off and on again, and Leave counts on one entry.
    if (!hasExtraEntry.current) {
      hasExtraEntry.current = true
      window.history.pushState(null, "", window.location.href)
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("popstate", handlePopState)
    // Capture: runs before the link's own click handler.
    document.addEventListener("click", handleClick, true)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("popstate", handlePopState)
      document.removeEventListener("click", handleClick, true)
    }
  }, [when])

  function leave() {
    if (!leaving) return
    hasConfirmed.current = true
    if (leaving.kind === "link") {
      router.push(leaving.href)
    } else {
      // This page's extra entry, then the page itself.
      window.history.go(-2)
    }
    setLeaving(null)
  }

  return (
    <AlertDialog open={leaving !== null} onOpenChange={(open) => !open && setLeaving(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. If you leave this page, they will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={leave}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
