-- Inventory for items, like Zoho: an inventory account, a valuation method, opening
-- stock and a reorder point on the item, plus a log of stock adjustments.
-- Stock on hand = opening stock + the sum of adjustments (later also sales and purchases).

create type public.inventory_valuation_method as enum (
  'FIFO (First In, First Out)',
  'WAC (Weighted Average Costing)'
);

create type public.stock_movement_type as enum ('Adjustment');

alter table public.items
  add column inventory_account text not null default 'Inventory Asset',
  add column inventory_valuation_method public.inventory_valuation_method
    not null default 'FIFO (First In, First Out)',
  add column opening_stock numeric(15, 4) not null default 0,
  add column opening_stock_rate numeric(15, 4) not null default 0,
  add column reorder_point numeric(15, 4),
  add constraint valid_opening_stock check (opening_stock >= 0),
  add constraint valid_opening_stock_rate check (opening_stock_rate >= 0),
  add constraint valid_reorder_point check (reorder_point is null or reorder_point >= 0),
  -- Only goods have stock.
  add constraint valid_inventory_for_goods check (type = 'Goods' or not track_inventory);

-- Each change to an item's stock. Rows are never edited or deleted: a mistake is
-- corrected with another adjustment, so the history stays complete.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  -- Items with stock history can't be deleted (mark them inactive instead).
  item_id uuid not null references public.items (id) on delete restrict,
  movement_type public.stock_movement_type not null default 'Adjustment',
  -- Positive adds stock, negative removes it.
  quantity numeric(15, 4) not null check (quantity <> 0),
  -- Cost per unit of stock added; not used for removals.
  rate numeric(15, 4) check (rate is null or rate >= 0),
  movement_date date not null default current_date,
  reason text not null check (char_length(trim(reason)) between 1 and 100),
  reference text check (reference is null or char_length(reference) <= 50),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index idx_stock_movements_item on public.stock_movements (item_id, movement_date desc, created_at desc);

-- Checks an adjustment before it is recorded: the item tracks inventory, is active, and
-- keeps a stock of zero or more. The item row is locked so two adjustments at the same
-- time can't both take the last units.
create or replace function private.check_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  current_stock numeric;
begin
  select track_inventory, is_active, opening_stock into target
  from public.items where id = new.item_id
  for update;

  if not found then
    raise exception 'This item no longer exists.' using errcode = '23503';
  end if;
  if not target.track_inventory then
    raise exception 'Turn on Track Inventory for this item before adjusting its stock.'
      using errcode = '23514';
  end if;
  if not target.is_active then
    raise exception 'This item is inactive. Mark it as active before adjusting its stock.'
      using errcode = '23514';
  end if;

  select target.opening_stock + coalesce(sum(quantity), 0) into current_stock
  from public.stock_movements where item_id = new.item_id;

  if current_stock + new.quantity < 0 then
    raise exception 'The stock can''t go below zero. There are only % in stock.',
      trim_scale(current_stock)
      using errcode = '23514';
  end if;

  -- Only the database decides who recorded it and when.
  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

revoke all on function private.check_stock_movement() from public;

create trigger stock_movements_check
  before insert on public.stock_movements
  for each row execute function private.check_stock_movement();

-- Keeps item changes consistent with its stock history: tracking can't be turned off
-- once stock has moved, and the opening stock can't drop below what has been removed.
create or replace function private.guard_item_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved numeric;
begin
  if new.track_inventory = old.track_inventory and new.opening_stock = old.opening_stock then
    return new;
  end if;

  select coalesce(sum(quantity), 0) into moved
  from public.stock_movements where item_id = new.id;

  if old.track_inventory and not new.track_inventory
    and exists (select 1 from public.stock_movements where item_id = new.id) then
    raise exception 'This item has stock adjustments, so Track Inventory can''t be turned off.'
      using errcode = '23514';
  end if;

  if new.opening_stock + moved < 0 then
    raise exception 'The opening stock is too low: more stock than that has already been removed.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_item_inventory() from public;

create trigger items_guard_inventory
  before update on public.items
  for each row execute function private.guard_item_inventory();

alter table public.stock_movements enable row level security;

revoke all on public.stock_movements from anon;
-- History only grows: no updates or deletes from the app.
revoke update, delete, truncate on public.stock_movements from authenticated;

create policy "View stock movements"
  on public.stock_movements for select to authenticated
  using (private.has_permission('items', 'view'));

create policy "Adjust stock"
  on public.stock_movements for insert to authenticated
  with check (private.has_permission('items', 'edit'));

-- item_list gains the new item columns (i.* is expanded when the view is created) and
-- the stock on hand.
drop view public.item_list;

create view public.item_list
with (security_invoker = true)
as
select
  i.*,
  h.code as hsn_code,
  case
    when i.track_inventory then
      i.opening_stock + coalesce(
        (select sum(m.quantity) from public.stock_movements m where m.item_id = i.id), 0)
  end as stock_on_hand
from public.items i
left join public.hsn_codes h on h.id = i.hsn_code_id;

revoke all on public.item_list from anon;
grant select on public.item_list to authenticated;
