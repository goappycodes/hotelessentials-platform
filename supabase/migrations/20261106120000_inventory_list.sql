-- The Inventory page: one row per active item that tracks inventory, with its stock and
-- what confirmed sales orders need of it.

alter table public.items
  add column reorder_level numeric(15, 4),
  add constraint valid_reorder_level check (reorder_level is null or reorder_level >= 0);

-- Totals per item. Runs as the owner so people who can see inventory get the right
-- reserved stock even without access to sales orders. It returns only quantities.
create or replace function private.item_stock_totals()
returns table (item_id uuid, on_hand numeric, ordered numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(stock.item_id, orders.item_id),
    coalesce(stock.quantity, 0),
    coalesce(orders.quantity, 0)
  from (
    select line.item_id, sum(line.quantity_adjusted) as quantity
    from public.inventory_adjustment_items line
    join public.inventory_adjustments adjustment on adjustment.id = line.adjustment_id
    where adjustment.status = 'Adjusted'
    group by line.item_id
  ) stock
  full join (
    select line.item_id, sum(line.quantity) as quantity
    from public.sales_order_items line
    join public.sales_orders sales_order on sales_order.id = line.sales_order_id
    where sales_order.status = 'Confirmed' and line.item_id is not null
    group by line.item_id
  ) orders on orders.item_id = stock.item_id;
$$;

revoke all on function private.item_stock_totals() from public;
-- Used by the inventory_list view, which runs as the caller.
grant execute on function private.item_stock_totals() to authenticated;

-- Reserved stock can't exceed what is in the warehouse, so an order bigger than the stock
-- shows as ordered 10, reserved 6, available 0. Incoming stays 0 until purchase orders exist.
create view public.inventory_list
with (security_invoker = true)
as
with levels as (
  select
    i.id,
    i.name,
    i.sku,
    i.unit,
    i.reorder_level,
    coalesce(totals.on_hand, 0) as current_stock,
    coalesce(totals.ordered, 0) as ordered_quantity,
    least(coalesce(totals.on_hand, 0), coalesce(totals.ordered, 0)) as reserved_stock
  from public.items i
  left join private.item_stock_totals() totals on totals.item_id = i.id
  where i.track_inventory and i.is_active
)
select
  id,
  name,
  sku,
  unit,
  current_stock,
  reserved_stock,
  current_stock - reserved_stock as available_stock,
  ordered_quantity,
  0::numeric as incoming_stock,
  reorder_level,
  case
    when current_stock - reserved_stock <= 0 then 'Out of Stock'
    when current_stock - reserved_stock <= reorder_level then 'Low Stock'
    else 'In Stock'
  end as stock_status
from levels;

revoke all on public.inventory_list from anon;
grant select on public.inventory_list to authenticated;
