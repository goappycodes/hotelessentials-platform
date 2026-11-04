-- Amounts and price list percentages can have up to 4 decimal places (e.g. 99.982),
-- instead of being rounded to 2.

-- item_list selects these columns, so it is dropped while their types change.
drop view public.item_list;

alter table public.items
  alter column selling_price type numeric(15, 4),
  alter column cost_price type numeric(15, 4);

alter table public.price_list_items
  alter column rate type numeric(15, 4);

alter table public.price_lists
  alter column percentage_value type numeric(10, 4);

-- Recreated unchanged (see 20261103060000_item_list_view.sql).
create view public.item_list
with (security_invoker = true)
as
select i.*, h.code as hsn_code
from public.items i
left join public.hsn_codes h on h.id = i.hsn_code_id;

revoke all on public.item_list from anon;
grant select on public.item_list to authenticated;
