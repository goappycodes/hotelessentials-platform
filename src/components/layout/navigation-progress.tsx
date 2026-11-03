"use client"

import { usePathname } from "next/navigation"
import { createContext, Suspense, use, useEffect, useState } from "react"

type PendingNavigation = { from: string; to: string }

const PendingPathContext = createContext<string | null>(null)

// Tracks client-side navigations started from any internal <Link>, so the UI can react
// on click instead of waiting for the next page to arrive.
export function NavigationProgressProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [pathname, setPathname] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingNavigation | null>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      // Next.js <Link> prevents the default only for client-side navigations,
      // so modifier-clicks, new tabs and external links are ignored here.
      if (!event.defaultPrevented || !(event.target instanceof Element)) return

      const anchor = event.target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return

      const url = new URL(anchor.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname) return

      setPending({ from: window.location.pathname, to: url.pathname })
    }

    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  // Once the pathname moves on from where the navigation started, it has finished.
  const pendingPath = pending && pending.from === pathname ? pending.to : null

  return (
    <PendingPathContext value={pendingPath}>
      {/* usePathname() needs <Suspense> on dynamic routes, so it is read in a child
          instead of here, where it would block prerendering of every page. */}
      <Suspense fallback={null}>
        <PathnameTracker onChange={setPathname} />
      </Suspense>
      {pendingPath && (
        <div
          role="progressbar"
          aria-label="Loading page"
          className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left animate-nav-progress bg-primary"
        />
      )}
      {children}
    </PendingPathContext>
  )
}

function PathnameTracker({ onChange }: { onChange: (pathname: string) => void }) {
  const pathname = usePathname()
  useEffect(() => onChange(pathname), [pathname, onChange])
  return null
}

// The path the user is navigating to while a navigation is in flight, otherwise the
// current path. Lets navigation UI highlight the destination immediately. Reads URL data,
// so use it inside <Suspense>.
export function useOptimisticPathname() {
  const pathname = usePathname()
  return use(PendingPathContext) ?? pathname
}
