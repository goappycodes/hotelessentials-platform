import { Brand } from "@/components/shared/brand"
import { Spinner } from "@/components/ui/spinner"

export default function RootLoading() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <Brand />
      <Spinner className="size-6 text-primary" />
    </main>
  )
}
