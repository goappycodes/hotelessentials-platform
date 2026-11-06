-- Sales orders can also be created by hand, without a quotation. public.save_sales_order
-- is the only way to do that, so numbers always come from the numbering and there is still
-- no direct insert on the tables.

alter table public.sales_orders alter column quote_number drop not null;

alter table public.sales_order_items
  add constraint sales_order_items_quantity_positive check (quantity > 0);

-- People creating orders pick from the same price lists as quotations.
alter policy "View price lists" on public.price_lists
  using (
    (select private.has_permission('price_lists', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
  );

alter policy "View price list items" on public.price_list_items
  using (
    (select private.has_permission('price_lists', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
  );

-- The next order number. lpad cuts longer text, so the width grows past 99999.
create or replace function private.next_sales_order_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number bigint := nextval('public.sales_order_number_seq');
begin
  return 'SO-' || lpad(next_number::text, greatest(5, length(next_number::text)), '0');
end;
$$;

revoke all on function private.next_sales_order_number() from public;

-- Creates a quotation's sales order, unless it already has one. Runs as the definer so
-- accepting a quotation works for anyone allowed to, whatever their sales order access.
create or replace function private.create_sales_order(quote_id uuid, placed_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_id uuid;
begin
  if exists (select 1 from public.sales_orders so where so.quotation_id = quote_id) then
    return;
  end if;

  insert into public.sales_orders (
    so_number, quotation_id, quote_number, customer_id, customer_name, order_date,
    reference_number, subject, salesperson_id, place_of_supply, discount_level,
    discount_value, discount_is_percent, is_discount_before_tax, adjustment,
    adjustment_description, notes, terms, sub_total, discount_total, tax_total, total
  )
  select
    private.next_sales_order_number(),
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

-- Creates a sales order by hand, with its lines, in one transaction. Runs as the definer
-- because the tables have no insert policy, so it checks the permission itself.
create or replace function public.save_sales_order(sales_order jsonb, items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.sales_orders;
  customer_display_name text;
  saved_id uuid;
begin
  if not private.has_permission('sales_orders', 'create') then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;

  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Add at least one item.' using errcode = '23514';
  end if;

  o := jsonb_populate_record(null::public.sales_orders, sales_order);

  select c.display_name into customer_display_name from public.customers c where c.id = o.customer_id;
  if customer_display_name is null then
    raise exception 'This customer no longer exists.' using errcode = '23503';
  end if;

  insert into public.sales_orders (
    so_number, customer_id, customer_name, order_date, reference_number, subject,
    salesperson_id, place_of_supply, status, discount_level, discount_value,
    discount_is_percent, is_discount_before_tax, adjustment, adjustment_description, notes,
    terms, sub_total, discount_total, tax_total, total
  )
  values (
    private.next_sales_order_number(), o.customer_id, customer_display_name, o.order_date,
    o.reference_number, o.subject, o.salesperson_id, o.place_of_supply,
    coalesce(o.status, 'Draft'), coalesce(o.discount_level, 'Line Item'),
    coalesce(o.discount_value, 0), coalesce(o.discount_is_percent, true),
    coalesce(o.is_discount_before_tax, true), coalesce(o.adjustment, 0),
    o.adjustment_description, o.notes, o.terms, coalesce(o.sub_total, 0),
    coalesce(o.discount_total, 0), coalesce(o.tax_total, 0), coalesce(o.total, 0)
  )
  returning id into saved_id;

  insert into public.sales_order_items (
    sales_order_id, item_id, name, description, hsn_code, unit, quantity, rate,
    discount_value, discount_is_percent, tax_id, tax_name, tax_rate, amount, sort_order
  )
  select saved_id, entry.item_id, trim(entry.name), entry.description, entry.hsn_code,
    entry.unit, entry.quantity, entry.rate, coalesce(entry.discount_value, 0),
    coalesce(entry.discount_is_percent, true), entry.tax_id, tax.name, tax.rate,
    entry.amount, entry.position - 1
  from rows from (
    jsonb_to_recordset(items) as (
      item_id uuid, name text, description text, hsn_code text, unit text,
      quantity numeric, rate numeric, discount_value numeric, discount_is_percent boolean,
      tax_id uuid, amount numeric
    )
  ) with ordinality as entry (
    item_id, name, description, hsn_code, unit, quantity, rate, discount_value,
    discount_is_percent, tax_id, amount, position
  )
  left join public.tax_rates tax on tax.id = entry.tax_id;

  return saved_id;
end;
$$;

revoke all on function public.save_sales_order(jsonb, jsonb) from public, anon;
grant execute on function public.save_sales_order(jsonb, jsonb) to authenticated;
