import {
  ADMIN_ROLES,
  APP_MODULES,
  ROLE_DEFAULT_PERMISSIONS,
  type AppModule,
  type PermissionAction,
  type UserRole,
} from "@/constants/permissions"
import type { Tables } from "@/types/database"

export type PermissionSet = Record<PermissionAction, boolean>

export type ModulePermissions = Record<AppModule, PermissionSet>

// What a nav item or page requires: a module permission, or owner/admin ("admin").
export type AccessScope = AppModule | "admin"

export type UserAccess = {
  role: UserRole
  permissions: ModulePermissions
}

const NO_PERMISSIONS: PermissionSet = {
  view: false,
  create: false,
  edit: false,
  delete: false,
}

export function isAdminRole(role: UserRole) {
  return ADMIN_ROLES.includes(role)
}

export function hasAccess(
  access: UserAccess,
  scope: AccessScope,
  action: PermissionAction = "view"
) {
  if (isAdminRole(access.role)) return true
  if (scope === "admin") return false
  return access.permissions[scope][action]
}

function buildPermissions(
  get: (module: AppModule) => PermissionSet | undefined
): ModulePermissions {
  return Object.fromEntries(
    APP_MODULES.map((module) => [module, get(module) ?? NO_PERMISSIONS])
  ) as ModulePermissions
}

type PermissionRow = Pick<
  Tables<"user_permissions">,
  "module" | "can_view" | "can_create" | "can_edit" | "can_delete"
>

export function toModulePermissions(rows: PermissionRow[]): ModulePermissions {
  return buildPermissions((module) => {
    const row = rows.find((entry) => entry.module === module)
    return row
      ? {
          view: row.can_view,
          create: row.can_create,
          edit: row.can_edit,
          delete: row.can_delete,
        }
      : undefined
  })
}

export function getRoleDefaultPermissions(role: UserRole): ModulePermissions {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role]
  return buildPermissions((module) => {
    const actions = defaults[module]
    return actions
      ? {
          view: actions.includes("view"),
          create: actions.includes("create"),
          edit: actions.includes("edit"),
          delete: actions.includes("delete"),
        }
      : undefined
  })
}

// The shape public.save_user expects. Any create/edit/delete implies view.
export function toPermissionRows(permissions: ModulePermissions) {
  return APP_MODULES.map((module) => {
    const set = permissions[module]
    return {
      module,
      can_view: set.view || set.create || set.edit || set.delete,
      can_create: set.create,
      can_edit: set.edit,
      can_delete: set.delete,
    }
  })
}
