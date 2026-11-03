import { Brand } from "@/components/shared/brand"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-accent-foreground lg:flex">
        <Brand />
        <div className="max-w-md space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">
            Run your hotel supply business in one place.
          </h2>
          <p className="text-sidebar-foreground">
            Items, discounts, quotations, sales orders, despatch and reporting
            for your whole team.
          </p>
        </div>
        <p className="text-sm text-sidebar-foreground/70">
          Secure, role-based access for your whole team.
        </p>
      </aside>
      <main className="flex flex-col items-center justify-center gap-8 px-4 py-10 sm:px-6">
        <Brand className="text-foreground lg:hidden" />
        {children}
      </main>
    </div>
  )
}
