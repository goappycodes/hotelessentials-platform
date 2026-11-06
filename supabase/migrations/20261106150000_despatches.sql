-- Despatch: goods leave against a confirmed sales order, on one or more despatches, each
-- with its own DN-00001 number. A despatch starts Packed (goods set aside, stock unchanged),
-- becomes Despatched (stock goes down) and then Delivered. When everything on an order has
-- gone, the order closes by itself.

create type public.despatch_status as enum ('Packed', 'Despatched', 'Delivered');

create sequence public.despatch_number_seq;

create table public.despatches (
  id uuid primary key default gen_random_uuid(),
  despatch_number text not null unique,
  -- Orders with despatches can't be deleted.
  sales_order_id uuid not null references public.sales_orders (id) on delete restrict,
  so_number text not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  customer_name text not null,
  despatch_date date not null,
  status public.despatch_status not null default 'Packed',
  transporter text check (transporter is null or char_length(transporter) <= 100),
  tracking_number text check (tracking_number is null or char_length(tracking_number) <= 100),
  vehicle_number text check (vehicle_number is null or char_length(vehicle_number) <= 30),
  notes text check (notes is null or char_length(notes) <= 500),
  -- Set by the database when the status changes.
  despatched_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_despatches_sales_order on public.despatches (sales_order_id);
create index idx_despatches_status on public.despatches (status);

create table public.despatch_items (
  id uuid primary key default gen_random_uuid(),
  despatch_id uuid not null references public.despatches (id) on delete cascade,
  sales_order_item_id uuid not null references public.sales_order_items (id) on delete restrict,
  item_id uuid references public.items (id) on delete set null,
  name text not null,
  description text,
  unit text,
  quantity numeric(15, 4) not null check (quantity > 0),
  -- This line took stock out: it has gone, and the item tracked inventory when it went.
  -- Items that start tracking later don't lose stock for what left before.
  deducts_stock boolean not null default false,
  sort_order integer not null default 0,
  unique (despatch_id, sales_order_item_id)
);

create index idx_despatch_items_order_line on public.despatch_items (sales_order_item_id);
create index idx_despatch_items_item on public.despatch_items (item_id);

create trigger despatches_set_updated_at
  before update on public.despatches
  for each row execute function private.set_updated_at();

-- Only the database records when a despatch went and arrived.
create or replace function private.stamp_despatch_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.despatched_at := case when new.status = 'Packed' then null
      else coalesce(old.despatched_at, now()) end;
    new.delivered_at := case when new.status = 'Delivered'
      then coalesce(old.delivered_at, now()) end;
  end if;
  return new;
end;
$$;

create trigger despatches_stamp_status
  before update of status on public.despatches
  for each row execute function private.stamp_despatch_status();

-- Stock on hand: adjusted lines, less what has been despatched.
create or replace function private.stock_on_hand(target_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(line.quantity_adjusted)
      from public.inventory_adjustment_items line
      join public.inventory_adjustments adjustment on adjustment.id = line.adjustment_id
      where line.item_id = target_item_id and adjustment.status = 'Adjusted'
    ), 0)
    - coalesce((
      select sum(line.quantity)
      from public.despatch_items line
      where line.item_id = target_item_id and line.deducts_stock
    ), 0);
$$;

-- Totals per item for the inventory_list view. Ordered is what confirmed orders still have
-- to send: what has gone is already out of stock, so it no longer needs reserving.
create or replace function private.item_stock_totals()
returns table (item_id uuid, on_hand numeric, ordered numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select movement.item_id, sum(movement.on_hand), sum(movement.ordered)
  from (
    select line.item_id, line.quantity_adjusted as on_hand, 0::numeric as ordered
    from public.inventory_adjustment_items line
    join public.inventory_adjustments adjustment on adjustment.id = line.adjustment_id
    where adjustment.status = 'Adjusted'
    union all
    select line.item_id, -line.quantity, 0
    from public.despatch_items line
    where line.deducts_stock
    union all
    select line.item_id, 0, greatest(line.quantity - coalesce(sent.quantity, 0), 0)
    from public.sales_order_items line
    join public.sales_orders sales_order on sales_order.id = line.sales_order_id
    left join (
      select despatch_line.sales_order_item_id, sum(despatch_line.quantity) as quantity
      from public.despatch_items despatch_line
      join public.despatches despatch on despatch.id = despatch_line.despatch_id
      where despatch.status <> 'Packed'
      group by despatch_line.sales_order_item_id
    ) sent on sent.sales_order_item_id = line.id
    where sales_order.status = 'Confirmed'
  ) movement
  where movement.item_id is not null
  group by movement.item_id;
$$;

-- When a despatch is saved or changes status. Runs at commit, once its lines are in, so a
-- despatch saved straight as Despatched is treated the same as one marked later.
create or replace function private.after_despatch_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_packed boolean := tg_op = 'INSERT' or old.status = 'Packed';
  short record;
  everything_sent boolean;
begin
  if new.status = 'Packed' then
    update public.despatch_items set deducts_stock = false
    where despatch_id = new.id and deducts_stock;
  elsif was_packed then
    -- Two despatches at the same time can't both take the last units.
    perform 1 from public.items i
    where i.id in (select line.item_id from public.despatch_items line where line.despatch_id = new.id)
    order by i.id
    for update;

    update public.despatch_items line
    set deducts_stock = true
    from public.items i
    where line.despatch_id = new.id and i.id = line.item_id and i.track_inventory;

    select i.name, private.stock_on_hand(i.id) as on_hand into short
    from public.despatch_items line
    join public.items i on i.id = line.item_id
    where line.despatch_id = new.id
      and line.deducts_stock
      and private.stock_on_hand(i.id) < 0
    limit 1;

    if found then
      raise exception 'Not enough stock of %: % short.', short.name, trim_scale(-short.on_hand)
        using errcode = '23514';
    end if;
  end if;

  perform 1 from public.sales_orders where id = new.sales_order_id for update;

  select not exists (
    select 1
    from public.sales_order_items line
    where line.sales_order_id = new.sales_order_id
      and line.quantity > coalesce((
        select sum(despatch_line.quantity)
        from public.despatch_items despatch_line
        join public.despatches despatch on despatch.id = despatch_line.despatch_id
        where despatch_line.sales_order_item_id = line.id and despatch.status <> 'Packed'
      ), 0)
  ) into everything_sent;

  if everything_sent then
    update public.sales_orders set status = 'Closed'
    where id = new.sales_order_id and status = 'Confirmed';
  elsif new.status = 'Packed' and not was_packed then
    -- Taken back: the order has goods to send again.
    update public.sales_orders set status = 'Confirmed'
    where id = new.sales_order_id and status = 'Closed';
  end if;

  return null;
end;
$$;

revoke all on function private.after_despatch_change() from public;

create constraint trigger despatches_after_change
  after insert or update of status on public.despatches
  deferrable initially deferred
  for each row execute function private.after_despatch_change();

-- An order with despatches has been acted on, so it can't go back to draft.
create or replace function private.guard_sales_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Draft' and old.status <> 'Draft'
    and exists (select 1 from public.despatches d where d.sales_order_id = new.id) then
    raise exception 'This order has despatches, so it can''t go back to draft.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_sales_order_status() from public;

create trigger sales_orders_guard_status
  before update of status on public.sales_orders
  for each row execute function private.guard_sales_order_status();

-- Row level security ----------------------------------------------------------------

alter table public.despatches enable row level security;
alter table public.despatch_items enable row level security;

revoke all on public.despatches, public.despatch_items from anon;
-- Created through save_despatch only. Numbers, the order and the lines never change.
revoke insert, update, truncate on public.despatches from authenticated;
revoke insert, update, delete, truncate on public.despatch_items from authenticated;
grant update (despatch_date, status, transporter, tracking_number, vehicle_number, notes)
  on public.despatches to authenticated;

-- Sales orders list their despatches, and an item's stock history shows what left.
create policy "View despatches"
  on public.despatches for select to authenticated
  using (
    (select private.has_permission('despatch', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
    or (select private.has_permission('inventory_adjustments', 'view'))
  );

create policy "Edit despatches"
  on public.despatches for update to authenticated
  using ((select private.has_permission('despatch', 'edit')))
  with check ((select private.has_permission('despatch', 'edit')));

-- Goods that have left stay on record; move a despatch back to Packed to remove it.
create policy "Delete despatches"
  on public.despatches for delete to authenticated
  using (status = 'Packed' and (select private.has_permission('despatch', 'delete')));

create policy "View despatch items"
  on public.despatch_items for select to authenticated
  using (
    (select private.has_permission('despatch', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
    or (select private.has_permission('inventory_adjustments', 'view'))
  );

-- People working on despatches see the orders, customers and items they send.
alter policy "View sales orders" on public.sales_orders
  using (
    (select private.has_permission('sales_orders', 'view'))
    or (select private.has_permission('despatch', 'view'))
  );

alter policy "View sales order items" on public.sales_order_items
  using (
    (select private.has_permission('sales_orders', 'view'))
    or (select private.has_permission('despatch', 'view'))
  );

alter policy "View customers" on public.customers
  using (
    (select private.has_permission('customers', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
    or (select private.has_permission('despatch', 'view'))
  );

alter policy "View items" on public.items
  using (
    (select private.has_permission('items', 'view'))
    or (select private.has_permission('price_lists', 'view'))
    or (select private.has_permission('inventory_adjustments', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
    or (select private.has_permission('despatch', 'view'))
  );

alter policy "View item images" on public.item_images
  using (
    (select private.has_permission('items', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
    or (select private.has_permission('inventory_adjustments', 'view'))
    or (select private.has_permission('despatch', 'view'))
  );

alter policy "View item image files" on storage.objects
  using (
    bucket_id = 'item-images'
    and (
      (select private.has_permission('items', 'view'))
      or (select private.has_permission('quotations', 'view'))
      or (select private.has_permission('sales_orders', 'view'))
      or (select private.has_permission('inventory_adjustments', 'view'))
      or (select private.has_permission('despatch', 'view'))
    )
  );

-- Saving ------------------------------------------------------------------------------

-- Creates a despatch and its lines in one transaction. Runs as the definer, with its own
-- permission check, so the number always comes from the sequence and the lines from the
-- order. A line can't send more than the order has left, counting packed despatches too.
-- despatch: { sales_order_id, despatch_date, status, transporter, tracking_number,
-- vehicle_number, notes }. items: [{ sales_order_item_id, quantity }].
create or replace function public.save_despatch(despatch jsonb, items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sales_order public.sales_orders;
  order_line public.sales_order_items;
  entry record;
  already_allotted numeric;
  next_number bigint;
  saved_id uuid;
begin
  if not private.has_permission('despatch', 'create') then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Add at least one item.' using errcode = '23514';
  end if;

  -- Locked, so two despatches at the same time can't both take what's left.
  select * into sales_order
  from public.sales_orders so
  where so.id = (despatch ->> 'sales_order_id')::uuid
  for update;

  if not found then
    raise exception 'This sales order no longer exists.' using errcode = 'P0002';
  end if;
  if sales_order.status <> 'Confirmed' then
    raise exception 'Only confirmed sales orders can be despatched.' using errcode = '23514';
  end if;

  next_number := nextval('public.despatch_number_seq');

  insert into public.despatches (
    despatch_number, sales_order_id, so_number, customer_id, customer_name, despatch_date,
    status, transporter, tracking_number, vehicle_number, notes,
    despatched_at, delivered_at
  )
  values (
    -- lpad cuts longer text, so the width grows past 99999.
    'DN-' || lpad(next_number::text, greatest(5, length(next_number::text)), '0'),
    sales_order.id, sales_order.so_number, sales_order.customer_id, sales_order.customer_name,
    (despatch ->> 'despatch_date')::date,
    (despatch ->> 'status')::public.despatch_status,
    nullif(trim(despatch ->> 'transporter'), ''),
    nullif(trim(despatch ->> 'tracking_number'), ''),
    nullif(trim(despatch ->> 'vehicle_number'), ''),
    nullif(trim(despatch ->> 'notes'), ''),
    case when despatch ->> 'status' <> 'Packed' then now() end,
    case when despatch ->> 'status' = 'Delivered' then now() end
  )
  returning id into saved_id;

  for entry in
    select line.sales_order_item_id, line.quantity, line.position
    from rows from (jsonb_to_recordset(items) as (sales_order_item_id uuid, quantity numeric))
      with ordinality as line (sales_order_item_id, quantity, position)
  loop
    select * into order_line
    from public.sales_order_items line
    where line.id = entry.sales_order_item_id and line.sales_order_id = sales_order.id;

    if not found then
      raise exception 'One of the items is no longer on this order.' using errcode = '23503';
    end if;

    select coalesce(sum(line.quantity), 0) into already_allotted
    from public.despatch_items line
    where line.sales_order_item_id = order_line.id;

    if entry.quantity is null or entry.quantity + already_allotted > order_line.quantity then
      raise exception 'Only % of % is left to despatch.',
        trim_scale(greatest(order_line.quantity - already_allotted, 0)), order_line.name
        using errcode = '23514';
    end if;

    insert into public.despatch_items (
      despatch_id, sales_order_item_id, item_id, name, description, unit, quantity, sort_order
    )
    values (
      saved_id, order_line.id, order_line.item_id, order_line.name, order_line.description,
      order_line.unit, entry.quantity, entry.position - 1
    );
  end loop;

  return saved_id;
end;
$$;

revoke all on function public.save_despatch(jsonb, jsonb) from public, anon;
grant execute on function public.save_despatch(jsonb, jsonb) to authenticated;
