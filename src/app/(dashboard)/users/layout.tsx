import { notFound } from "next/navigation"

// Users and their permissions are switched off for now, so /users, /users/add and
// /users/[id] show "not found". The pages and forms are untouched. To bring them back,
// delete this file and restore the Users link in src/constants/navigation.ts.
//
// Only these screens are off: permission checks across the app (hasAccess, RLS) still run.
export default function UsersLayout() {
  notFound()
}
