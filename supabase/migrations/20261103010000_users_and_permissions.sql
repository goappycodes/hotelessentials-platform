-- Single-company access model: every user has a role on their profile, and non-admin
-- roles get per-module permissions. Replaces the organization-based tenancy from the
-- foundation migration.

create type public.user_role as enum (
  'owner',
  'admin',
  'manager',
  'accountant',
  'sales',
  'staff'
);

-- Profiles -----------------------------------------------------------------

alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column phone text,
  add column role public.user_role not null default 'staff',
  add column is_active boolean not null default true;

-- Carry existing users over: names from full_name (or the email), roles from their
-- organization membership.
update public.profiles
set first_name = left(coalesce(nullif(trim(full_name), ''), split_part(email, '@', 1)), 50);

update public.profiles p
set role = case m.role
    when 'owner' then 'owner'::public.user_role
    when 'admin' then 'admin'::public.user_role
    else 'staff'::public.user_role
  end
from public.organization_members m
where m.user_id = p.id;

-- A company always needs an owner; promote the earliest user if none came across.
update public.profiles
set role = 'owner'
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'owner');

alter table public.profiles
  alter column first_name set not null,
  drop column full_name,
  add constraint profiles_email_key unique (email),
  add constraint profiles_first_name_length
    check (char_length(trim(first_name)) between 1 and 50),
  add constraint profiles_last_name_length
    check (last_name is null or char_length(last_name) <= 50),
  add constraint profiles_phone_length
    check (phone is null or char_length(phone) <= 30);

-- Remove organizations -----------------------------------------------------

drop policy "Users can view their own profile and profiles of teammates" on public.profiles;
drop function public.create_organization(text);
drop table public.organization_members;
drop table public.organizations;
drop function private.is_org_member(uuid);
drop function private.has_org_role(uuid, public.organization_role[]);
drop function private.shares_org_with(uuid);
drop type public.organization_role;

-- User permissions ---------------------------------------------------------
-- Owners and admins have full access and need no rows here.

create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null check (
    module in ('items', 'discounts', 'quotations', 'sales_orders', 'despatch', 'reports')
  ),
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The unique index also serves lookups by user_id.
  unique (user_id, module),
  constraint user_permissions_view_required
    check (can_view or not (can_create or can_edit or can_delete))
);

create trigger user_permissions_set_updated_at
  before update on public.user_permissions
  for each row execute function private.set_updated_at();

-- Authorization helpers ----------------------------------------------------
-- SECURITY DEFINER so policies can read the caller's profile without recursive RLS.

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active;
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_role() is not null;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() in ('owner', 'admin'), false);
$$;

-- For module tables: e.g. `using (private.has_permission('items', 'view'))`.
create or replace function private.has_permission(module_name text, action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1
    from public.user_permissions up
    join public.profiles p on p.id = up.user_id and p.is_active
    where up.user_id = (select auth.uid())
      and up.module = module_name
      and case action
        when 'view' then up.can_view
        when 'create' then up.can_create
        when 'edit' then up.can_edit
        when 'delete' then up.can_delete
        else false
      end
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_permission(text, text) to authenticated;

-- Row Level Security -------------------------------------------------------

alter table public.user_permissions enable row level security;

-- Users can always read their own profile, so the app can tell them their account is
-- deactivated. Everyone else needs an active account.
create policy "Active users can view profiles"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or private.is_active_user());

drop policy "Users can update their own profile" on public.profiles;

create policy "Active users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and private.is_active_user())
  with check (id = (select auth.uid()));

create policy "Users can view their own permissions; admins can view all"
  on public.user_permissions for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

-- Users edit only their own contact details. Role, status and permissions change only
-- through public.save_user, which checks the caller is an owner or admin.
grant update (first_name, last_name, phone, avatar_url) on public.profiles to authenticated;
revoke all on public.user_permissions from anon;
revoke insert, update, delete on public.user_permissions from authenticated;

-- New user provisioning ----------------------------------------------------
-- Accounts are created server-side with the admin API. The first account becomes the
-- owner; everyone else starts as staff until an admin saves their role.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone, role)
  values (
    new.id,
    new.email,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
        split_part(new.email, '@', 1)
      ),
      50
    ),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    case
      when exists (select 1 from public.profiles) then 'staff'::public.user_role
      else 'owner'::public.user_role
    end
  );
  return new;
end;
$$;

-- User management ----------------------------------------------------------
-- Saves a user's details, role, status and permissions in one transaction.
-- Rules: only owners and admins manage users, only owners manage owners, and nobody
-- changes their own role or deactivates themselves (so an active owner always remains).

create or replace function public.save_user(
  target_user_id uuid,
  first_name text,
  last_name text,
  phone text,
  role public.user_role,
  is_active boolean,
  permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role public.user_role := private.current_user_role();
  target_role public.user_role;
begin
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can manage users.' using errcode = '42501';
  end if;

  select p.role into target_role
  from public.profiles p
  where p.id = target_user_id
  for update;

  if not found then
    raise exception 'This user no longer exists.' using errcode = 'P0002';
  end if;

  if caller_role <> 'owner' and (target_role = 'owner' or save_user.role = 'owner') then
    raise exception 'Only an owner can manage owners.' using errcode = '42501';
  end if;

  if target_user_id = caller_id
    and (save_user.role <> target_role or not save_user.is_active) then
    raise exception 'You cannot change your own role or deactivate your own account.'
      using errcode = '42501';
  end if;

  update public.profiles p
  set first_name = trim(save_user.first_name),
      last_name = nullif(trim(save_user.last_name), ''),
      phone = nullif(trim(save_user.phone), ''),
      role = save_user.role,
      is_active = save_user.is_active
  where p.id = target_user_id;

  delete from public.user_permissions up where up.user_id = target_user_id;

  if save_user.role not in ('owner', 'admin') then
    insert into public.user_permissions
      (user_id, module, can_view, can_create, can_edit, can_delete)
    select
      target_user_id,
      entry.module,
      true,
      coalesce(entry.can_create, false),
      coalesce(entry.can_edit, false),
      coalesce(entry.can_delete, false)
    from jsonb_to_recordset(coalesce(save_user.permissions, '[]'::jsonb)) as entry (
      module text,
      can_view boolean,
      can_create boolean,
      can_edit boolean,
      can_delete boolean
    )
    where coalesce(entry.can_view, false)
      or coalesce(entry.can_create, false)
      or coalesce(entry.can_edit, false)
      or coalesce(entry.can_delete, false);
  end if;
end;
$$;

revoke all on function public.save_user(uuid, text, text, text, public.user_role, boolean, jsonb)
  from public, anon;
grant execute on function public.save_user(uuid, text, text, text, public.user_role, boolean, jsonb)
  to authenticated;
