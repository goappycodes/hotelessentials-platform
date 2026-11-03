import { Ellipsis, Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import {
  ListActionsMenu,
  type ListActionsMenuProps,
} from "@/components/shared/list-actions-menu"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type ListPageActionsProps = ListActionsMenuProps & {
  create?: { href: string; title: string }
}

export function ListPageActions({ create, ...menuProps }: ListPageActionsProps) {
  return (
    <>
      {create && (
        <Button asChild>
          <Link href={create.href} aria-label={create.title}>
            <Plus />
            New
          </Link>
        </Button>
      )}
      <Suspense
        fallback={
          <Button variant="outline" size="icon" disabled aria-label="More actions">
            <Ellipsis />
          </Button>
        }
      >
        <ListActionsMenu {...menuProps} />
      </Suspense>
    </>
  )
}

export function ListPageActionsSkeleton() {
  return (
    <div aria-busy="true" className="flex gap-2">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="size-8" />
    </div>
  )
}
