import { UsersRound } from "lucide-react"
import Link from "next/link"

import { countUsers } from "@/actions/users"
import {
  ListPagination,
  ListPaginationSkeleton,
} from "@/components/shared/list-pagination"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ROLE_LABELS } from "@/constants/permissions"
import { userRoute } from "@/constants/routes"
import { USERS_LIST } from "@/features/users/list-config"
import {
  applyListQuery,
  parseListQuery,
  toListPage,
  type ListSearchParams,
} from "@/lib/list-query"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"
import { getInitials } from "@/lib/utils"

const COLUMNS = ["Name", "Email", "Phone", "Role", "Status", "Created"]

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

export async function UsersTable({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>
}) {
  const [params, session, supabase] = await Promise.all([
    searchParams,
    requireUser(),
    createRequestClient(),
  ])
  const query = parseListQuery(params, USERS_LIST)

  const { data, error } = await applyListQuery(
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, role, is_active, created_at"),
    query
  )
  if (error) throw new Error("Failed to load users")

  const { rows, hasNextPage } = toListPage(data, query)
  const isFiltered = Object.keys(query.filters).length > 0 || query.search !== null

  return (
    <>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>No users found</EmptyTitle>
              <EmptyDescription>
                {isFiltered
                  ? "No users match your search or filters."
                  : "There are no users on this page."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column}
                    className="h-10 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const fullName = [user.first_name, user.last_name]
                  .filter(Boolean)
                  .join(" ")

                return (
                  <TableRow key={user.id} className="relative">
                    <TableCell className="px-4 py-3">
                      {/* The link covers the whole row, so any cell opens the user. */}
                      <Link
                        href={userRoute(user.id)}
                        className="flex items-center gap-3 font-medium text-primary after:absolute after:inset-0 hover:underline"
                      >
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                            {getInitials(fullName)}
                          </AvatarFallback>
                        </Avatar>
                        {fullName}
                        {user.id === session.user.id && (
                          <Badge variant="outline">You</Badge>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4">{user.email}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {user.phone ?? "—"}
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                    </TableCell>
                    <TableCell className="px-4">
                      {user.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {dateFormat.format(new Date(user.created_at))}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <ListPagination
        config={USERS_LIST}
        itemCount={rows.length}
        hasNextPage={hasNextPage}
        countAction={countUsers}
      />
    </>
  )
}

export function UsersTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Card className="flex-1 gap-0 overflow-hidden py-0">
        <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
          {COLUMNS.map((column) => (
            <Skeleton key={column} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b px-4 py-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
      <ListPaginationSkeleton />
    </div>
  )
}
