import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import {
  PageHeader,
  PageHeaderSkeleton,
  type BreadcrumbEntry,
} from "@/components/layout/page-header"
import { AccessDenied } from "@/components/shared/access-denied"
import { DASHBOARD_NAV_ITEM, MODULE_NAV_ITEMS } from "@/constants/navigation"
import {
  UserForm,
  UserFormSkeleton,
} from "@/features/users/components/user-form"
import { isAdminRole, toModulePermissions } from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { createRequestClient } from "@/lib/supabase/server"
import { userIdSchema } from "@/lib/validations/user"

const navItem = MODULE_NAV_ITEMS.users

export const metadata: Metadata = { title: "Edit User" }

function breadcrumbs(name: string): BreadcrumbEntry[] {
  return [
    { label: DASHBOARD_NAV_ITEM.title, href: DASHBOARD_NAV_ITEM.href },
    { label: navItem.title, href: navItem.href },
    { label: name },
  ]
}

export default function EditUserPage({ params }: PageProps<"/users/[id]">) {
  return (
    <PageContainer className="max-w-4xl">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <UserFormSkeleton />
          </>
        }
      >
        <EditUser params={params} />
      </Suspense>
    </PageContainer>
  )
}

async function EditUser({ params }: Pick<PageProps<"/users/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requireUser()])

  if (!isAdminRole(session.role)) {
    return (
      <>
        <PageHeader title="Edit User" breadcrumbs={breadcrumbs("Edit User")} />
        <AccessDenied area="user management" />
      </>
    )
  }

  if (!userIdSchema.safeParse(id).success) notFound()

  const supabase = await createRequestClient()
  const [profileResult, permissionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, email, phone, role, is_active")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("user_permissions")
      .select("module, can_view, can_create, can_edit, can_delete")
      .eq("user_id", id),
  ])
  if (profileResult.error || permissionsResult.error) {
    throw new Error("Failed to load the user")
  }

  const profile = profileResult.data
  if (!profile) notFound()

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ")

  return (
    <>
      <PageHeader
        title={fullName}
        description="Update their details, role and what they can access."
        breadcrumbs={breadcrumbs(fullName)}
      />
      <UserForm
        mode="edit"
        userId={id}
        canAssignOwner={session.role === "owner"}
        isSelf={id === session.user.id}
        readOnly={profile.role === "owner" && session.role !== "owner"}
        defaultValues={{
          firstName: profile.first_name,
          lastName: profile.last_name ?? "",
          email: profile.email,
          phone: profile.phone ?? "",
          password: "",
          role: profile.role,
          isActive: profile.is_active,
          permissions: toModulePermissions(permissionsResult.data),
        }}
      />
    </>
  )
}
