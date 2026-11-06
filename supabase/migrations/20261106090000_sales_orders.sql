-- Sales orders. Accepting a quotation creates one, numbered SO-00001, with a copy of the
-- quotation's details and lines. The quotation stays as it is, and later changes to it
-- don't change the order.

create type public.sales_order_status as enum ('Open', 'Closed', 'Cancelled');

create sequence public.sales_order_number_seq;

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  so_number text not null unique,
  -- One order per quotation. Deleting the quotation leaves the order.
  quotation_id uuid unique references public.quotations (id) on delete set null,
  quote_number text not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  customer_name text not null,
  order_date date not null,
  reference_number text,
  subject text,
  salesperson_id uuid references public.profiles (id) on delete set null,
  place_of_supply text,
  status public.sales_order_status not null default 'Open',
  discount_level public.discount_level not null default 'Line Item',
  discount_value numeric(15, 4) not null default 0,
  discount_is_percent boolean not null default true,
  is_discount_before_tax boolean not null default true,
  adjustment numeric(15, 4) not null default 0,
  adjustment_description text,
  notes text,
  terms text,
  sub_total numeric(15, 2) not null default 0,
  discount_total numeric(15, 2) not null default 0,
  tax_total numeric(15, 2) not null default 0,
  total numeric(15, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sales_orders_customer on public.sales_orders (customer_id);
create index idx_sales_orders_order_date on public.sales_orders (order_date desc);
create index idx_sales_orders_status on public.sales_orders (status);

create trigger sales_orders_set_updated_at
  before update on public.sales_orders
  for each row execute function private.set_updated_at();

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,
  -- The item it came from; the name and numbers below are kept even if the item changes.
  item_id uuid references public.items (id) on delete set null,
  name text not null,
  description text,
  hsn_code text,
  unit text,
  quantity numeric(15, 4) not null,
  rate numeric(15, 4) not null,
  discount_value numeric(18, 8) not null default 0,
  discount_is_percent boolean not null default true,
  tax_id uuid references public.tax_rates (id) on delete set null,
  tax_name text,
  tax_rate numeric(5, 2),
  amount numeric(15, 2) not null default 0,
  sort_order integer not null default 0
);

create index idx_sales_order_items_order on public.sales_order_items (sales_order_id, sort_order);

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
revoke all on public.sales_orders, public.sales_order_items from anon;

-- There is no insert policy: orders only come from accepted quotations (below).
create policy "View sales orders"
  on public.sales_orders for select to authenticated
  using ((select private.has_permission('sales_orders', 'view')));

create policy "Edit sales orders"
  on public.sales_orders for update to authenticated
  using ((select private.has_permission('sales_orders', 'edit')))
  with check ((select private.has_permission('sales_orders', 'edit')));

create policy "Delete sales orders"
  on public.sales_orders for delete to authenticated
  using ((select private.has_permission('sales_orders', 'delete')));

create policy "View sales order items"
  on public.sales_order_items for select to authenticated
  using ((select private.has_permission('sales_orders', 'view')));

-- People viewing sales orders see the customer and items on them.
alter policy "View customers" on public.customers
  using (
    (select private.has_permission('customers', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
  );

alter policy "View items" on public.items
  using (
    (select private.has_permission('items', 'view'))
    or (select private.has_permission('price_lists', 'view'))
    or (select private.has_permission('inventory_adjustments', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
  );

alter policy "View item images" on public.item_images
  using (
    (select private.has_permission('items', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
  );

alter policy "View item image files" on storage.objects
  using (
    bucket_id = 'item-images'
    and (
      (select private.has_permission('items', 'view'))
      or (select private.has_permission('quotations', 'view'))
      or (select private.has_permission('sales_orders', 'view'))
    )
  );

-- Creates a quotation's sales order, unless it already has one. Runs as the definer so
-- accepting a quotation works for anyone allowed to, whatever their sales order access.
create or replace function private.create_sales_order(quote_id uuid, placed_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number bigint;
  order_id uuid;
begin
  if exists (select 1 from public.sales_orders so where so.quotation_id = quote_id) then
    return;
  end if;

  next_number := nextval('public.sales_order_number_seq');

  insert into public.sales_orders (
    so_number, quotation_id, quote_number, customer_id, customer_name, order_date,
    reference_number, subject, salesperson_id, place_of_supply, discount_level,
    discount_value, discount_is_percent, is_discount_before_tax, adjustment,
    adjustment_description, notes, terms, sub_total, discount_total, tax_total, total
  )
  select
    -- lpad cuts longer text, so the width grows past 99999.
    'SO-' || lpad(next_number::text, greatest(5, length(next_number::text)), '0'),
    q.id, q.quote_number, q.customer_id, q.customer_name, placed_on,
    q.reference_number, q.subject, q.salesperson_id, q.place_of_supply, q.discount_level,
    q.discount_value, q.discount_is_percent, q.is_discount_before_tax, q.adjustment,
    q.adjustment_description, q.notes, q.terms, q.sub_total, q.discount_total, q.tax_total,
    q.total
  from public.quotations q
  where q.id = quote_id
  returning id into order_id;

  if order_id is null then
    return;
  end if;

  insert into public.sales_order_items (
    sales_order_id, item_id, name, description, hsn_code, unit, quantity, rate,
    discount_value, discount_is_percent, tax_id, tax_name, tax_rate, amount, sort_order
  )
  select order_id, line.item_id, line.name, line.description, line.hsn_code, line.unit,
    line.quantity, line.rate, line.discount_value, line.discount_is_percent, line.tax_id,
    line.tax_name, line.tax_rate, line.amount, line.sort_order
  from public.quotation_items line
  where line.quotation_id = quote_id;
end;
$$;

revoke all on function private.create_sales_order(uuid, date) from public;

create or replace function private.sales_order_on_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.create_sales_order(
    new.id,
    -- An imported quotation was accepted back then; otherwise it's today.
    case when tg_op = 'INSERT' then new.quote_date
         else (now() at time zone 'Asia/Kolkata')::date end
  );
  return null;
end;
$$;

revoke all on function private.sales_order_on_accept() from public;

-- Deferred to the end of the save, so the lines (saved after the quotation) are there.
create constraint trigger quotations_order_on_insert
  after insert on public.quotations
  deferrable initially deferred
  for each row
  when (new.status = 'Accepted')
  execute function private.sales_order_on_accept();

create constraint trigger quotations_order_on_accept
  after update of status on public.quotations
  deferrable initially deferred
  for each row
  when (new.status = 'Accepted' and old.status is distinct from new.status)
  execute function private.sales_order_on_accept();

-- Quotations already accepted get theirs now, oldest first, so numbers follow the dates.
do $$
declare
  quote record;
begin
  for quote in
    select q.id, q.quote_date from public.quotations q
    where q.status = 'Accepted'
    order by q.quote_date, q.created_at, q.quote_number
  loop
    perform private.create_sales_order(quote.id, quote.quote_date);
  end loop;
end;
$$;
