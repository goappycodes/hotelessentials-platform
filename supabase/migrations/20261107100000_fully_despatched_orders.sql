-- An order with everything despatched stays closed: there is nothing left to confirm. Moving
-- a despatch back to Packed still reopens it, because something is then left to send.

create or replace function private.is_fully_despatched(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.sales_order_items line
    where line.sales_order_id = target_order_id
      and line.quantity > coalesce((
        select sum(despatch_line.quantity)
        from public.despatch_items despatch_line
        join public.despatches despatch on despatch.id = despatch_line.despatch_id
        where despatch_line.sales_order_item_id = line.id and despatch.status <> 'Packed'
      ), 0)
  );
$$;

revoke all on function private.is_fully_despatched(uuid) from public;

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

  if new.status = 'Confirmed' and old.status = 'Closed'
    and exists (select 1 from public.despatches d where d.sales_order_id = new.id)
    and private.is_fully_despatched(new.id) then
    raise exception 'Everything on this order has been despatched, so it stays closed.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Orders reopened by hand before this rule.
update public.sales_orders so
set status = 'Closed'
where so.status = 'Confirmed'
  and exists (select 1 from public.despatches d where d.sales_order_id = so.id)
  and private.is_fully_despatched(so.id);
