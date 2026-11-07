-- Boxes on a despatch: each line says which box it travels in and how many are in that box,
-- so one item can be spread across boxes (a row per box). Despatches saved before this have
-- no box number; new ones must have one.

alter table public.despatch_items
  add column box_number text
    check (box_number is null or char_length(trim(box_number)) between 1 and 20),
  drop constraint despatch_items_despatch_id_sales_order_item_id_key,
  add constraint despatch_items_one_row_per_box
    unique nulls not distinct (despatch_id, sales_order_item_id, box_number);

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
  -- From the import; a despatch made in the app gets the next number.
  saved_number text := nullif(trim(despatch ->> 'despatch_number'), '');
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

  while saved_number is null loop
    next_number := nextval('public.despatch_number_seq');
    -- lpad cuts longer text, so the width grows past 99999.
    saved_number := 'DN-' || lpad(next_number::text, greatest(5, length(next_number::text)), '0');
    if exists (select 1 from public.despatches d where d.despatch_number = saved_number) then
      saved_number := null;
    end if;
  end loop;

  insert into public.despatches (
    despatch_number, sales_order_id, so_number, customer_id, customer_name, despatch_date,
    status, transporter, tracking_number, vehicle_number, notes,
    despatched_at, delivered_at
  )
  values (
    saved_number,
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
    select line.sales_order_item_id, line.box_number, line.quantity, line.position
    from rows from (
      jsonb_to_recordset(items) as (sales_order_item_id uuid, box_number text, quantity numeric)
    ) with ordinality as line (sales_order_item_id, box_number, quantity, position)
  loop
    select * into order_line
    from public.sales_order_items line
    where line.id = entry.sales_order_item_id and line.sales_order_id = sales_order.id;

    if not found then
      raise exception 'One of the items is no longer on this order.' using errcode = '23503';
    end if;

    if nullif(trim(entry.box_number), '') is null then
      raise exception 'Enter a box number for %.', order_line.name using errcode = '23514';
    end if;

    -- Earlier rows of this despatch count too, so an item split across boxes can't pass it.
    select coalesce(sum(line.quantity), 0) into already_allotted
    from public.despatch_items line
    where line.sales_order_item_id = order_line.id;

    if entry.quantity is null or entry.quantity + already_allotted > order_line.quantity then
      raise exception 'Only % of % is left to despatch.',
        trim_scale(greatest(order_line.quantity - already_allotted, 0)), order_line.name
        using errcode = '23514';
    end if;

    insert into public.despatch_items (
      despatch_id, sales_order_item_id, item_id, name, description, unit, box_number, quantity,
      sort_order
    )
    values (
      saved_id, order_line.id, order_line.item_id, order_line.name, order_line.description,
      order_line.unit, trim(entry.box_number), entry.quantity, entry.position - 1
    );
  end loop;

  return saved_id;
end;
$$;
