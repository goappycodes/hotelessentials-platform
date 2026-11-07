import { Sparkles } from "lucide-react"

// The bar above an opened record that says what to do next, with the button for it.
export function WhatsNext({
  children,
  actions,
}: {
  children: React.ReactNode
  actions: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
      <Sparkles className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">WHAT&apos;S NEXT?</span> {children}
      </p>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}
