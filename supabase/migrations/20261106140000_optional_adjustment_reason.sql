-- An inventory adjustment no longer needs a reason. Empty reasons are stored as null.

alter table public.inventory_adjustments
  alter column reason drop not null,
  drop constraint inventory_adjustments_reason_check,
  add constraint inventory_adjustments_reason_check
    check (reason is null or char_length(trim(reason)) between 1 and 100);

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
      nullif(trim(save_inventory_adjustment.reason), ''),
      nullif(trim(save_inventory_adjustment.description), ''),
      save_inventory_adjustment.status
    )
    returning id into saved_id;
  else
    update public.inventory_adjustments a
    set adjustment_date = save_inventory_adjustment.adjustment_date,
        reference_number = nullif(trim(save_inventory_adjustment.reference_number), ''),
        account = trim(save_inventory_adjustment.account),
        reason = nullif(trim(save_inventory_adjustment.reason), ''),
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
