@AGENTS.md

# Project conventions

## Loading states (required for every page)

- Every new route must ship with a loading skeleton. Add a `loading.tsx` next to the
  `page.tsx` when the page's layout differs from the generic fallback
  (`src/app/(dashboard)/loading.tsx` → `PageSkeleton`), and wrap any session- or
  data-dependent section in `<Suspense>` with a skeleton fallback.
- Build skeletons only from the shadcn `Skeleton` (`@/components/ui/skeleton`), and use
  the shadcn `Spinner` for inline/button loading. Do not hand-roll pulsing divs or spinners.
- A skeleton mirrors the real component's layout and lives next to it as
  `<ComponentName>Skeleton` (e.g. `PageHeaderSkeleton`, `DashboardOverviewSkeleton`,
  `AuthCardSkeleton`). Reuse those before writing new ones.
- Mark skeleton roots with `aria-busy="true"` and an `sr-only` "Loading…" label.

## Data access and speed

- Read the signed-in user (profile, role, permissions) in components only through
  `requireUser()` from `src/lib/session.ts`. It is cached with
  `"use cache: private"` (5-minute stale time), so navigations and prefetched App Shells
  reuse them instead of calling Supabase again.
- Server Actions authorize with the uncached `fetchSession()` and must call `refresh()`
  (from `next/cache`) after anything that changes the signed-in user's own session or profile.

## Access control

- One company. Roles live on `profiles.role`; owners and admins have full access, other
  roles use `user_permissions` (per module: view/create/edit/delete).
- Gate pages and buttons with `AccessGate` / `hasAccess` and the nav item's `access`, but
  treat that as presentation: every module table needs RLS using
  `private.has_permission('<module>', '<action>')`.
- Role, status and permission changes go through `public.save_user` only. The secret key
  (`src/lib/supabase/admin.ts`) is for Auth admin calls only, after authorizing the caller.
- Server Components that query Supabase directly must use `createRequestClient()` (it calls
  `connection()`), otherwise prerendering fails on supabase-js reading `Date.now()`.
  Server Actions and Route Handlers use `createClient()`.
- Session-dependent UI goes inside `<Suspense>` with a skeleton; never await session data
  at the top of a layout.
- Judge speed with `npm run build && npm run start`. `next dev` does not prefetch links,
  so it always shows loading states on navigation.

## UI components

Reuse an existing project component first, then install from shadcn/ui
(`npx shadcn@latest add <name>`), then customize with Tailwind. Create a custom component
only when neither exists. Feature components go in `src/features/<feature>/components`,
reusable app components in `src/components/shared`, layout pieces in
`src/components/layout`.

## Forms

- Build forms from the shared fields in `src/components/shared`: `FormInputField`
  (`startAddon`/`endAddon` for ₹ or %), `FormSelectField`, `FormComboboxField` (searchable,
  optional "add what you typed") and `FormTextareaField`. All take `required` (red label
  with *), `hint` (help tooltip) and `orientation="horizontal"` for Zoho-style rows with
  the label on the left.
- Money and percentages are strings in forms (validated with `MONEY_PATTERN`) and
  converted to numbers in the Server Action.

## Pages

- Dashboard pages render inside `PageContainer` with a `PageHeader` (title, description,
  breadcrumbs).
- List pages keep sort, order, filters, `page` and `per_page` in the URL. Declare a
  `ListConfig`, use `ListPageActions` (toolbar) and `ListPagination` (footer), and fetch
  with `parseListQuery` + `applyListQuery` + `toListPage` from `src/lib/list-query.ts`
  inside a `<Suspense>` boundary. See "List pages" in the README.
- Module navigation, including each module's `/add` create route, is defined once in
  `src/constants/navigation.ts`; add routes to `src/constants/routes.ts`.
