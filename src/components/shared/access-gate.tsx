import type { PermissionAction } from "@/constants/permissions"
import { hasAccess, type AccessScope } from "@/lib/permissions"
import { requireUser } from "@/lib/session"

type AccessGateProps = {
  scope?: AccessScope
  action?: PermissionAction
  denied?: React.ReactNode
  children: React.ReactNode
}

// Renders children only when the signed-in user has the permission. Reads the session,
// so place it inside <Suspense>. This hides UI; the database enforces access with RLS.
export async function AccessGate({
  scope,
  action = "view",
  denied = null,
  children,
}: AccessGateProps) {
  const session = await requireUser()
  if (scope && !hasAccess(session, scope, action)) return denied
  return children
}
