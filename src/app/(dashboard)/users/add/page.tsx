import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import {
  UserForm,
  UserFormSkeleton,
} from "@/features/users/components/user-form"
import { isAdminRole } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

const navItem = MODULE_NAV_ITEMS.users

export const metadata: Metadata = { title: navItem.create.title }

export default function NewUserPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title={navItem.create.title}
        description="Create an account and choose what this person can access."
        breadcrumbs={[
          { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
          { label: navItem.title, href: navItem.href },
          { label: navItem.create.title },
        ]}
      />
      <Suspense fallback={<UserFormSkeleton />}>
        <NewUserForm />
      </Suspense>
    </PageContainer>
  )
}

async function NewUserForm() {
  const { role } = await requireUser()
  if (!isAdminRole(role)) return <AccessDenied area="user management" />
  return <UserForm mode="create" canAssignOwner={role === "owner"} />
}
