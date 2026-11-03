-- Tax rates set up by owners and admins (Settings → Taxes). Items pick an intra-state
-- tax (CGST + SGST) and an inter-state tax (IGST) instead of storing fixed percentages,
-- so changing a tax rate applies to every item that uses it.

create type public.tax_scope as enum ('Intra-state', 'Inter-state');

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 50),
  tax_scope public.tax_scope not null,
  -- Intra-state taxes are split into CGST and SGST; inter-state taxes are IGST.
  cgst_rate numeric(5, 2),
  sgst_rate numeric(5, 2),
  igst_rate numeric(5, 2),
  rate numeric(5, 2) generated always as (coalesce(cgst_rate + sgst_rate, igst_rate)) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_tax_components check (
    (
      tax_scope = 'Intra-state'
      and cgst_rate is not null and sgst_rate is not null and igst_rate is null
    )
    or (
      tax_scope = 'Inter-state'
      and igst_rate is not null and cgst_rate is null and sgst_rate is null
    )
  ),
  constraint valid_tax_percentages check (
    coalesce(cgst_rate, 0) between 0 and 100
    and coalesce(sgst_rate, 0) between 0 and 100
    and coalesce(igst_rate, 0) between 0 and 100
  )
);

create unique index idx_tax_rates_name_unique on public.tax_rates (lower(name));

create trigger tax_rates_set_updated_at
  before update on public.tax_rates
  for each row execute function private.set_updated_at();

-- The standard GST slabs to start with; edit or deactivate them in Settings → Taxes.
insert into public.tax_rates (name, tax_scope, cgst_rate, sgst_rate) values
  ('GST0', 'Intra-state', 0, 0),
  ('GST5', 'Intra-state', 2.5, 2.5),
  ('GST12', 'Intra-state', 6, 6),
  ('GST18', 'Intra-state', 9, 9),
  ('GST28', 'Intra-state', 14, 14);

insert into public.tax_rates (name, tax_scope, igst_rate) values
  ('IGST0', 'Inter-state', 0),
  ('IGST5', 'Inter-state', 5),
  ('IGST12', 'Inter-state', 12),
  ('IGST18', 'Inter-state', 18),
  ('IGST28', 'Inter-state', 28);

alter table public.tax_rates enable row level security;
revoke all on public.tax_rates from anon;

create policy "Active users can view tax rates"
  on public.tax_rates for select to authenticated
  using (private.is_active_user());

create policy "Admins can add tax rates"
  on public.tax_rates for insert to authenticated
  with check (private.is_admin());

create policy "Admins can change tax rates"
  on public.tax_rates for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "Admins can delete tax rates"
  on public.tax_rates for delete to authenticated
  using (private.is_admin());

-- Items reference tax rates ----------------------------------------------------

alter table public.items
  add column intra_state_tax_id uuid references public.tax_rates (id) on delete restrict,
  add column inter_state_tax_id uuid references public.tax_rates (id) on delete restrict;

-- Carry over any existing items whose percentages match a starting slab.
update public.items i
set intra_state_tax_id = (
      select t.id from public.tax_rates t
      where t.tax_scope = 'Intra-state' and t.rate = i.intra_state_tax_rate
    ),
    inter_state_tax_id = (
      select t.id from public.tax_rates t
      where t.tax_scope = 'Inter-state' and t.rate = i.inter_state_tax_rate
    );

alter table public.items
  drop column intra_state_tax_rate,
  drop column inter_state_tax_rate,
  add constraint valid_taxes_for_taxable check (
    tax_preference <> 'Taxable'
    or (intra_state_tax_id is not null and inter_state_tax_id is not null)
  );

create index idx_items_intra_state_tax on public.items (intra_state_tax_id);
create index idx_items_inter_state_tax on public.items (inter_state_tax_id);

-- An item's intra-state tax must be CGST + SGST, and its inter-state tax IGST.
create or replace function private.check_item_tax_scopes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.intra_state_tax_id is not null and not exists (
    select 1 from public.tax_rates t
    where t.id = new.intra_state_tax_id and t.tax_scope = 'Intra-state'
  ) then
    raise exception 'The intra-state tax must be a CGST + SGST rate.' using errcode = '23514';
  end if;

  if new.inter_state_tax_id is not null and not exists (
    select 1 from public.tax_rates t
    where t.id = new.inter_state_tax_id and t.tax_scope = 'Inter-state'
  ) then
    raise exception 'The inter-state tax must be an IGST rate.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.check_item_tax_scopes() from public;

create trigger items_check_tax_scopes
  before insert or update of intra_state_tax_id, inter_state_tax_id on public.items
  for each row execute function private.check_item_tax_scopes();

-- A tax's scope cannot change while items use it, or items would point at the wrong kind.
create or replace function private.prevent_tax_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tax_scope <> old.tax_scope and exists (
    select 1 from public.items i
    where i.intra_state_tax_id = old.id or i.inter_state_tax_id = old.id
  ) then
    raise exception 'This tax is used by items, so its type cannot change.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_tax_scope_change() from public;

create trigger tax_rates_prevent_scope_change
  before update of tax_scope on public.tax_rates
  for each row execute function private.prevent_tax_scope_change();
