# hotelessentials

Business management platform for a hotel supply company. This repository holds the
foundation: authentication, users with roles and per-module permissions, user
management, tax settings, the Items and Price Lists modules, and the dashboard shell with
placeholder pages for the remaining Phase 1 modules (Quotations, Sales Orders, Despatch,
Reports).

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, Cache Components, Partial Prefetching) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 with design tokens in `src/app/globals.css` |
| UI | shadcn/ui (Radix base, `nova` preset) and Lucide icons |
| Forms | React Hook Form and Zod |
| Backend | Supabase (Postgres, Auth, Storage) via `@supabase/ssr` |

## Project structure

```
src/
├── actions/              Server Actions (auth, users)
├── app/
│   ├── (auth)/           Centered auth layout: login, forgot/reset password
│   │   └── auth/         /auth/confirm (email links), /auth/error, /auth/sign-out
│   ├── (dashboard)/      Sidebar layout: dashboard, Phase 1 modules, users
│   ├── layout.tsx        Root layout (fonts, metadata, toaster, tooltip provider)
│   └── page.tsx          Redirects to /dashboard
├── components/
│   ├── layout/           App sidebar, header, user menu, page header
│   ├── shared/           Reusable app components (forms, list toolbar, pagination, access gate)
│   └── ui/               shadcn/ui components
├── constants/            Routes, navigation, list settings, roles and permissions
├── features/             Feature-scoped components (auth, dashboard, users)
├── hooks/                Client hooks
├── lib/
│   ├── supabase/         Browser, server and admin clients, proxy session refresh, error mapping
│   ├── validations/      Zod schemas shared by forms and Server Actions
│   ├── env.ts            Validated public environment variables
│   ├── list-query.ts     URL ↔ Supabase sorting, filters and pagination
│   ├── permissions.ts    Role and permission checks shared by server and client
│   └── session.ts        Server-only data access layer for the current user
├── proxy.ts              Next.js Proxy (formerly middleware): session refresh and route guards
└── types/                Database and action result types
supabase/
├── config.toml           Supabase CLI configuration (local development)
└── migrations/           SQL migrations
```

## Prerequisites

- Node.js 20.9 or newer (developed on Node 24)
- npm
- A Supabase project ([supabase.com](https://supabase.com))
- Optional: Supabase CLI (`npx supabase`) to push migrations and generate types

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL from Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key (`sb_publishable_…`). The legacy `anon` key also works. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public base URL of the app, used to build email links (`http://localhost:3000` locally) |
| `SUPABASE_SECRET_KEY` | Yes, for user management | Secret key (`sb_secret_…`) from Project Settings → API keys. Server-only. |

The public variables are validated at startup by `src/lib/env.ts`, so a missing or
malformed value fails fast with a clear error. The secret key is checked when it is
first used.

Security rules:

- The secret key is read only in `src/lib/supabase/admin.ts` (`server-only`), and only
  for Auth admin calls (creating, deactivating and deleting accounts) after the caller is
  verified as an owner or admin. Never put it in a `NEXT_PUBLIC_` variable.
- Table reads and writes always use the signed-in user's session, so Row Level Security
  and the database checks apply.
- `.env*` files are git-ignored (only `.env.example` is committed).

## Supabase setup

### 1. Apply the database schema

Apply the migrations in `supabase/migrations/` in order:

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npx supabase db push
```

They create:

- `profiles`: one row per auth user (first and last name, email, phone, role, active
  status), created automatically by a trigger on `auth.users`. The first account becomes
  the owner; later accounts start as staff until an admin saves their role.
- `user_role` enum: `owner`, `admin`, `manager`, `accountant`, `sales`, `staff`.
- `user_permissions`: per-module `can_view`, `can_create`, `can_edit`, `can_delete` for
  non-admin roles. Owners and admins have full access and need no rows.
- `public.save_user(...)`: saves a user's details, role, status and permissions in one
  transaction, and enforces who may do what (see below).
- Helper functions in a non-exposed `private` schema used by RLS policies:
  `current_user_role()`, `is_active_user()`, `is_admin()` and
  `has_permission(module, action)`.
- Items: `items`, `hsn_codes`, `item_images` and a private `item-images` Storage bucket
  (JPG, PNG, WebP or GIF up to 5 MB, read through short-lived signed URLs).
- `tax_rates`: intra-state (CGST + SGST) and inter-state (IGST) taxes, starting with the
  GST 0/5/12/18/28% slabs. Items reference their two taxes.
- Price lists: `price_lists`, `price_list_items`, and `public.save_price_list(...)`, which
  saves a list and its item rates in one transaction.

### 2. Configure authentication

In Dashboard → Authentication:

1. **Sign In / Providers → Email**: keep Email enabled and **Confirm email** on.
2. **Sign In / Providers → User Signups**: turn **Allow new users to sign up** off.
   There is no public registration; owners and admins create accounts on the Users page.
   Leaving signups on would let anyone call the Auth API directly with the publishable key.
3. **URL Configuration**: set **Site URL** to your app URL and add
   `http://localhost:3000/**` (and your production URL with `/**`) to **Redirect URLs**.
4. **Password security** (recommended): minimum length 8 and require lowercase,
   uppercase and digits, matching the client-side rules.

### 3. Email templates (recommended)

The default templates work out of the box. `/auth/confirm` exchanges the PKCE `code`,
which requires the link to be opened in the same browser that requested it. To make
links work on any device, change the reset template to the token-hash format:

| Template | Link |
| --- | --- |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` |

The default Supabase email service only delivers to members of your Supabase
organization and is heavily rate limited. Configure a custom SMTP provider before
real users rely on password reset.

### 4. Regenerate database types (after schema changes)

`src/types/database.ts` mirrors the schema. After changing it, regenerate:

```bash
npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts
```

## Local development

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On a new project, create the first
user in the Supabase dashboard (Authentication → Users → Add user, with **Auto Confirm
User** checked). That account becomes the owner; add everyone else from **Users** in the
app.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |

## How authentication works

- **Session refresh**: `src/proxy.ts` runs on every non-static request, refreshes the
  Supabase session through `@supabase/ssr` (`getClaims()` verifies the JWT), and writes
  updated cookies to the response.
- **Route guards (proxy)**: unauthenticated users are redirected to `/login`
  (`/reset-password` goes to `/forgot-password`). Signed-in users are redirected away
  from `/login` and `/forgot-password`. `/auth/*` is always reachable.
- **Data access layer**: `src/lib/session.ts` (`server-only`) exposes `requireUser()`
  (cached per user) and the uncached `fetchSession()` for Server Actions. The session
  holds the user's profile, role and module permissions.
- **Server Actions** (`src/actions/`) re-validate every input with Zod and re-check the
  session before mutating anything.
- **Email links**: `/auth/confirm` accepts `token_hash` + `type` (verifyOtp) or `code`
  (PKCE exchange), only allows same-origin relative `next` paths, and redirects to
  `/auth/error` on failure.
- **Password reset**: `/forgot-password` → email → `/auth/confirm` → `/reset-password`.
  The response never reveals whether an email address has an account.

## Users, roles and permissions

| Role | Access |
| --- | --- |
| Owner | Everything, including managing other owners |
| Admin | Everything, and manages users except owners |
| Manager, Accountant, Sales, Staff | What their permissions allow, per module and action |

Picking a role on the user form fills in that role's usual permissions
(`ROLE_DEFAULT_PERMISSIONS` in `src/constants/permissions.ts`); admins can then adjust
them per user.

Rules enforced in the database by `public.save_user` (and mirrored in the UI):

- Only active owners and admins can manage users.
- Only an owner can make someone an owner or edit an owner.
- Nobody can change their own role or deactivate themselves, so an active owner always
  remains.

**Deactivating** a user sets `is_active = false` and bans the auth account, so they cannot
sign in or refresh their session. RLS treats inactive users as having no access. If they
are signed in at the time, they are signed out on their next page load
(`/auth/sign-out`) and see a notice on the login page.

**In the app**, the sidebar only lists modules the user can view and shows the "+"
quick-create only where they can create. Module pages render "You don't have access"
otherwise (`AccessGate`). This is presentation only: protect each module's tables with
RLS as described below. Permission changes reach a signed-in user's sidebar within
5 minutes (the session cache) or on their next full reload; RLS applies them immediately.

## List pages: sorting, filters and pagination

A list's view lives in the URL, for example
`/users?sort=created_at&order=desc&page=2&per_page=50&role=sales`, so it survives
reloads and can be shared.

| Param | Values | Default |
| --- | --- | --- |
| `sort` | a `value` from the list's `sortOptions` | `defaultSort` |
| `order` | `asc`, `desc` | `defaultOrder` |
| `page` | 1, 2, … | 1 |
| `per_page` | 10, 25, 50, 100, 200 | 200 |
| `q` | search text, matched case-insensitively against `search.columns` | none |
| filter keys | the values allowed in `filters` | none |

**Header search** is scoped to the module you are in. Typing shows up to five matching
records in a dropdown (title, details, status); clicking one, or arrowing to it and
pressing Enter, opens it. Enter otherwise (or "Search all …") shows the module's list
filtered by the search (`?q=`). Pages outside a module (dashboard, reports) show no search
box. Press `/` anywhere to focus the search.

To add search to a module:

1. Set `search: { placeholder, scope }` on its nav item (`src/constants/navigation.ts`).
2. Set `search.columns` on its `ListConfig` (used by both the list and the suggestions).
3. Write a provider returning `SearchResult[]` (see `src/features/users/search.ts`) and
   register it in `PROVIDERS` in `src/actions/search.ts`. Access is checked there.

Each list declares a `ListConfig` (`src/constants/list.ts`). Anything not in it is ignored,
so the URL can never sort or filter on another column. The toolbar (`ListPageActions`),
filter dropdowns (`ListFilterMenu`) and footer (`ListPagination`) update the URL through
`useListQuery`. Changing the sort, a filter or the page size goes back to page 1.

On the server, parse the same URL and apply it to the Supabase query. The Users list
(`src/features/users/components/users-table.tsx`) is a working example:

```tsx
const query = parseListQuery(await searchParams, USERS_LIST)
const { data, error } = await applyListQuery(
  supabase.from("profiles").select("id, first_name, email"),
  query
)
if (error) throw new Error("Failed to load users")
const { rows, hasNextPage } = toListPage(data, query)

// …render rows, then:
<ListPagination
  config={USERS_LIST}
  itemCount={rows.length}
  hasNextPage={hasNextPage}
  countAction={countUsers}
/>
```

`countAction` is an optional Server Action that receives the current filters and returns
the total row count. It runs only when the user clicks **Total Count: View**, so large
tables are not counted on every page load. Render the component that awaits
`searchParams` inside `<Suspense>` with a skeleton, so the page header stays instant.

## Items

`/items` lists items with a thumbnail, SKU, type, HSN code, rates and status (filters: type,
status; header search: name, SKU or HSN code, through the `item_list` view that joins each
item's HSN code). Clicking an item opens it on the same page
(`/items?item=<id>`): the list narrows to the left and the item shows on the right with
Overview, Transactions and History tabs. Its header has Edit (`/items/<id>/edit`), Adjust
Stock (disabled until there is an Inventory module) and More: Clone Item (opens New Item
prefilled, SKU cleared), Mark as Inactive/Active, Delete (with confirmation) and Lock item.
A locked item can't be edited or deleted until an owner or admin unlocks it; the database
enforces this.

The item form follows Zoho:

- **Details**: name, type (goods or service), unit (pick or type your own), SKU (unique,
  ignoring case), HSN code and tax preference. Goods need an HSN code; new HSN codes can be
  added from the search box ("Add HSN code …").
- **Images**: up to 5 per item, dragged in or browsed. New images upload when the item is
  saved; removing a saved image deletes it straight away.
- **Sales / purchase information**: selling and cost price, account, description,
  preferred vendor. Either side can be switched off.
- **Default tax rates**: taxable items pick an intra-state tax and an inter-state tax from
  Settings → Taxes.

An item used in a price list cannot be deleted; mark it inactive instead.

## Taxes

Owners and admins manage taxes in **Settings → Taxes**. An intra-state tax is split into
CGST and SGST (e.g. GST18 = CGST 9% + SGST 9%); an inter-state tax is IGST (e.g. IGST18).
Items keep a reference to their taxes, so editing a tax applies to every item using it.
A tax in use cannot be deleted or change between intra- and inter-state; deactivate it to
stop it being picked for new items.

## Price lists

`/price-lists` holds sales or purchase price lists of two kinds:

- **All Items**: a markup or markdown percentage on every item's selling (or cost) price,
  with optional rounding: nearest whole number, .99, .50, .49 or a number of decimal
  places. The form shows a worked example; `applyPriceAdjustment` in
  `src/lib/price-lists.ts` does the calculation for other modules to reuse.
- **Individual Items**: a custom rate per item. Items left blank keep their normal rate.

## Next steps for modules

Each new module table (quotations, sales orders, despatches) should enable RLS with the
permission helper, using the module names from `APP_MODULES`, as the items and price list
tables do (see `supabase/migrations/20261103030000_items_and_price_lists.sql`):

```sql
create policy "View quotations" on public.quotations for select to authenticated
  using (private.has_permission('quotations', 'view'));
create policy "Create quotations" on public.quotations for insert to authenticated
  with check (private.has_permission('quotations', 'create'));
```

Planned module dependencies: Items/Price Lists/Customers → Quotations → Sales Orders →
Despatch, and Reports reading from all of them.
