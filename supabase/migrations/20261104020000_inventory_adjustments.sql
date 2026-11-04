-- Inventory is its own module, like Zoho: stock changes through inventory adjustments
-- (a header with a reason and date, plus one line per item), saved as a draft or adjusted.
-- Items keep only their inventory account and valuation method.
-- Replaces the per-item stock fields and stock_movements from 20261104010000.

-- Undo the per-item stock model -------------------------------------------------

drop view public.item_list;
drop trigger items_guard_inventory on public.items;
drop function private.guard_item_inventory();
drop table public.stock_movements;
drop function private.check_stock_movement();
drop type public.stock_movement_type;

alter table public.items
  drop constraint valid_opening_stock,
  drop constraint valid_opening_stock_rate,
  drop constraint valid_reorder_point,
  drop column opening_stock,
  drop column opening_stock_rate,
  drop column reorder_point;

-- Permissions -------------------------------------------------------------------

alter table public.user_permissions drop constraint user_permissions_module_check;

alter table public.user_permissions
  add constraint user_permissions_module_check check (
    module in (
      'items', 'price_lists', 'inventory_adjustments', 'quotations', 'sales_orders',
      'despatch', 'reports'
    )
  );

-- Adjustments name items, so people who work with adjustments can see items too.
drop policy "View items" on public.items;

create policy "View items"
  on public.items for select to authenticated
  using (
    private.has_permission('items', 'view')
    or private.has_permission('price_lists', 'view')
    or private.has_permission('inventory_adjustments', 'view')
  );

-- Adjustments ---------------------------------------------------------------------

create type public.adjustment_mode as enum ('Quantity Adjustment', 'Value Adjustment');

create type public.adjustment_status as enum ('Draft', 'Adjusted');

create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  mode public.adjustment_mode not null default 'Quantity Adjustment',
  reference_number text check (reference_number is null or char_length(reference_number) <= 50),
  adjustment_date date not null default current_date,
  account text not null default 'Cost of Goods Sold'
    check (char_length(trim(account)) between 1 and 100),
  reason text not null check (char_length(trim(reason)) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  -- Drafts don't change stock; adjusted ones do.
  status public.adjustment_status not null default 'Draft',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Value adjustments need stock valuation, which isn't built yet.
  constraint quantity_adjustments_only check (mode = 'Quantity Adjustment')
);

create trigger inventory_adjustments_set_updated_at
  before update on public.inventory_adjustments
  for each row execute function private.set_updated_at();

create index idx_inventory_adjustments_date
  on public.inventory_adjustments (adjustment_date desc, created_at desc);
create index idx_inventory_adjustments_status on public.inventory_adjustments (status);

create table public.inventory_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.inventory_adjustments (id) on delete cascade,
  -- Items with stock history can't be deleted (mark them inactive instead).
  item_id uuid not null references public.items (id) on delete restrict,
  -- Positive adds stock, negative removes it.
  quantity_adjusted numeric(15, 4) not null check (quantity_adjusted <> 0),
  sort_order integer not null default 0,
  unique (adjustment_id, item_id)
);

create index idx_inventory_adjustment_items_item on public.inventory_adjustment_items (item_id);

-- Stock on hand: the sum of every adjusted (not draft) line for the item.
create or replace function private.stock_on_hand(target_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(line.quantity_adjusted), 0)
  from public.inventory_adjustment_items line
  join public.inventory_adjustments adjustment on adjustment.id = line.adjustment_id
  where line.item_id = target_item_id and adjustment.status = 'Adjusted';
$$;

revoke all on function private.stock_on_hand(uuid) from public;
-- Used by the item_list view, which runs as the caller.
grant execute on function private.stock_on_hand(uuid) to authenticated;

-- Only goods that track inventory can be adjusted, and new lines need an active item.
create or replace function private.check_adjustment_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  if tg_op = 'UPDATE' and new.item_id = old.item_id then
    return new;
  end if;

  select name, track_inventory, is_active into target
  from public.items where id = new.item_id;

  if not found then
    raise exception 'One of the items no longer exists.' using errcode = '23503';
  end if;
  if not target.track_inventory then
    raise exception '% doesn''t track inventory. Turn on Track Inventory for it first.', target.name
      using errcode = '23514';
  end if;
  if not target.is_active then
    raise exception '% is inactive. Mark it as active before adjusting its stock.', target.name
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.check_adjustment_item() from public;

create trigger inventory_adjustment_items_check_item
  before insert or update on public.inventory_adjustment_items
  for each row execute function private.check_adjustment_item();

-- Adjusted adjustments stay adjusted (they can still be edited or deleted).
create or replace function private.guard_adjustment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'Adjusted' and new.status = 'Draft' then
    raise exception 'An adjusted adjustment can''t go back to draft.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger inventory_adjustments_guard_status
  before update on public.inventory_adjustments
  for each row execute function private.guard_adjustment_status();

-- Stock never goes below zero. Checked when the transaction commits, after every line
-- and status change is in, so an adjustment is judged as a whole. The item rows are
-- locked first, so two adjustments at the same time can't both take the last units.
create or replace function private.check_stock_levels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_ids uuid[];
  short record;
begin
  if tg_table_name = 'inventory_adjustment_items' then
    item_ids := array_remove(
      array[
        case when tg_op <> 'DELETE' then new.item_id end,
        case when tg_op <> 'INSERT' then old.item_id end
      ],
      null
    );
  else
    select array_agg(line.item_id) into item_ids
    from public.inventory_adjustment_items line
    where line.adjustment_id = case when tg_op = 'DELETE' then old.id else new.id end;
  end if;

  if item_ids is null or cardinality(item_ids) = 0 then
    return null;
  end if;

  perform 1 from public.items where id = any (item_ids) order by id for update;

  select i.name, private.stock_on_hand(i.id) as on_hand into short
  from public.items i
  where i.id = any (item_ids) and private.stock_on_hand(i.id) < 0
  limit 1;

  if found then
    raise exception 'Not enough stock of %: this would leave % in stock.',
      short.name, trim_scale(short.on_hand)
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function private.check_stock_levels() from public;

create constraint trigger inventory_adjustment_items_check_stock
  after insert or update or delete on public.inventory_adjustment_items
  deferrable initially deferred
  for each row execute function private.check_stock_levels();

create constraint trigger inventory_adjustments_check_stock
  after update of status or delete on public.inventory_adjustments
  deferrable initially deferred
  for each row execute function private.check_stock_levels();

-- Like Zoho, inventory tracking can't be turned off once the item has adjustments.
create or replace function private.guard_item_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.track_inventory and not new.track_inventory
    and exists (select 1 from public.inventory_adjustment_items where item_id = new.id) then
    raise exception 'This item has inventory adjustments, so Track Inventory can''t be turned off.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_item_inventory() from public;

create trigger items_guard_inventory
  before update on public.items
  for each row execute function private.guard_item_inventory();

-- Row level security ----------------------------------------------------------------

alter table public.inventory_adjustments enable row level security;
alter table public.inventory_adjustment_items enable row level security;

revoke all on public.inventory_adjustments, public.inventory_adjustment_items from anon;

create policy "View inventory adjustments"
  on public.inventory_adjustments for select to authenticated
  using (private.has_permission('inventory_adjustments', 'view'));

create policy "Create inventory adjustments"
  on public.inventory_adjustments for insert to authenticated
  with check (private.has_permission('inventory_adjustments', 'create'));

create policy "Edit inventory adjustments"
  on public.inventory_adjustments for update to authenticated
  using (private.has_permission('inventory_adjustments', 'edit'))
  with check (private.has_permission('inventory_adjustments', 'edit'));

create policy "Delete inventory adjustments"
  on public.inventory_adjustments for delete to authenticated
  using (private.has_permission('inventory_adjustments', 'delete'));

-- Item stock history (items panel) is visible to anyone who can view items.
create policy "View inventory adjustment items"
  on public.inventory_adjustment_items for select to authenticated
  using (
    private.has_permission('inventory_adjustments', 'view')
    or private.has_permission('items', 'view')
  );

create policy "Add inventory adjustment items"
  on public.inventory_adjustment_items for insert to authenticated
  with check (
    private.has_permission('inventory_adjustments', 'create')
    or private.has_permission('inventory_adjustments', 'edit')
  );

create policy "Edit inventory adjustment items"
  on public.inventory_adjustment_items for update to authenticated
  using (private.has_permission('inventory_adjustments', 'edit'))
  with check (private.has_permission('inventory_adjustments', 'edit'));

create policy "Remove inventory adjustment items"
  on public.inventory_adjustment_items for delete to authenticated
  using (private.has_permission('inventory_adjustments', 'edit'));

-- Items panel history: adjusted lines need their adjustment's date and reason.
create policy "Item viewers can view adjusted adjustments"
  on public.inventory_adjustments for select to authenticated
  using (status = 'Adjusted' and private.has_permission('items', 'view'));

-- Saving ------------------------------------------------------------------------------

-- Creates (target_id null) or updates an adjustment and its lines in one transaction.
-- Runs as the caller, so the policies above apply. items: [{ item_id, quantity_adjusted }].
create or replace function public.save_inventory_adjustment(
  target_id uuid,
  adjustment_date date,
  reference_number text,
  account text,
  reason text,
  description text,
  status public.adjustment_status,
  items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Add at least one item.' using errcode = '23514';
  end if;

  if target_id is null then
    insert into public.inventory_adjustments (
      adjustment_date, reference_number, account, reason, description, status
    )
    values (
      save_inventory_adjustment.adjustment_date,
      nullif(trim(save_inventory_adjustment.reference_number), ''),
      trim(save_inventory_adjustment.account),
      trim(save_inventory_adjustment.reason),
      nullif(trim(save_inventory_adjustment.description), ''),
      save_inventory_adjustment.status
    )
    returning id into saved_id;
  else
    update public.inventory_adjustments a
    set adjustment_date = save_inventory_adjustment.adjustment_date,
        reference_number = nullif(trim(save_inventory_adjustment.reference_number), ''),
        account = trim(save_inventory_adjustment.account),
        reason = trim(save_inventory_adjustment.reason),
        description = nullif(trim(save_inventory_adjustment.description), ''),
        status = save_inventory_adjustment.status
    where a.id = target_id
    returning a.id into saved_id;

    if saved_id is null then
      raise exception 'This adjustment no longer exists.' using errcode = 'P0002';
    end if;
  end if;

  -- Lines that were removed, then the rest inserted or updated in place (so items on an
  -- existing line don't need to be active any more).
  delete from public.inventory_adjustment_items line
  where line.adjustment_id = saved_id
    and line.item_id not in (
      select (entry ->> 'item_id')::uuid from jsonb_array_elements(items) entry
    );

  insert into public.inventory_adjustment_items (adjustment_id, item_id, quantity_adjusted, sort_order)
  select saved_id, entry.item_id, entry.quantity_adjusted, entry.position - 1
  from rows from (jsonb_to_recordset(items) as (item_id uuid, quantity_adjusted numeric))
    with ordinality as entry (item_id, quantity_adjusted, position)
  on conflict (adjustment_id, item_id) do update
    set quantity_adjusted = excluded.quantity_adjusted,
        sort_order = excluded.sort_order;

  return saved_id;
end;
$$;

revoke all on function public.save_inventory_adjustment(
  uuid, date, text, text, text, text, public.adjustment_status, jsonb
) from public, anon;
grant execute on function public.save_inventory_adjustment(
  uuid, date, text, text, text, text, public.adjustment_status, jsonb
) to authenticated;

-- Lists -------------------------------------------------------------------------------

-- item_list again, now with stock on hand from adjustments (null when not tracked).
create view public.item_list
with (security_invoker = true)
as
select
  i.*,
  h.code as hsn_code,
  case when i.track_inventory then private.stock_on_hand(i.id) end as stock_on_hand
from public.items i
left join public.hsn_codes h on h.id = i.hsn_code_id;

revoke all on public.item_list from anon;
grant select on public.item_list to authenticated;
