-- Multi-tenant foundation: profiles, organizations and organization memberships.

create schema if not exists private;

create type public.organization_role as enum ('owner', 'admin', 'member');

-- Shared trigger function --------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles -----------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Organizations ------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function private.set_updated_at();

-- Authorization helpers ----------------------------------------------------
-- SECURITY DEFINER lets policies check membership without recursive RLS evaluation.
-- They live in the private schema so they are not exposed through the Data API.

create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_org_role(
  org_id uuid,
  roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

create or replace function private.shares_org_with(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other_user_id
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.organization_role[]) to authenticated;
grant execute on function private.shares_org_with(uuid) to authenticated;

-- Row Level Security -------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "Users can view their own profile and profiles of teammates"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members can view their organizations"
  on public.organizations for select
  to authenticated
  using (private.is_org_member(id));

create policy "Owners and admins can update their organization"
  on public.organizations for update
  to authenticated
  using (private.has_org_role(id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_org_role(id, array['owner', 'admin']::public.organization_role[]));

create policy "Members can view memberships of their organizations"
  on public.organization_members for select
  to authenticated
  using (private.is_org_member(organization_id));

-- Organizations and memberships are written only through controlled functions
-- or server-side operations, so direct table privileges are narrowed.
revoke all on public.profiles, public.organizations, public.organization_members from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
revoke insert, delete on public.organizations from authenticated;
revoke insert, update, delete on public.organization_members from authenticated;

-- New user provisioning ----------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Organization creation ----------------------------------------------------
-- Creates the organization and the caller's owner membership in one transaction.

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_org_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if org_name is null or char_length(trim(org_name)) not between 2 and 100 then
    raise exception 'Organization name must be between 2 and 100 characters'
      using errcode = '22023';
  end if;

  insert into public.organizations (name, created_by)
  values (trim(org_name), current_user_id)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, current_user_id, 'owner');

  return new_org_id;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
