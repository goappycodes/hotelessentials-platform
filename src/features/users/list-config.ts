import type { ListConfig } from "@/constants/list"
import { ROLE_LABELS, USER_ROLES } from "@/constants/permissions"

export const USERS_LIST: ListConfig = {
  sortOptions: [
    { value: "first_name", label: "Name" },
    { value: "email", label: "Email" },
    { value: "created_at", label: "Created Time" },
    { value: "updated_at", label: "Last Modified Time" },
  ],
  defaultSort: "first_name",
  defaultOrder: "asc",
  filters: {
    role: USER_ROLES,
    is_active: ["true", "false"],
  },
  search: { columns: ["first_name", "last_name", "email", "phone"] },
}

export const USER_ROLE_FILTER_OPTIONS = USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

export const USER_STATUS_FILTER_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]
