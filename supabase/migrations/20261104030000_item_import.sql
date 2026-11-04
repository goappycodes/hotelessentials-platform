-- Item import from Zoho Books CSV exports.
-- - HSN codes are optional for goods (many Zoho items have none; add them later).
-- - HSN codes created by an import have no description, so it is optional.
-- - items.external_id keeps the source system's item ID (Zoho "Item ID"), so importing
--   the same file again updates those items instead of adding copies.

alter table public.items drop constraint valid_hsn_for_goods;

alter table public.hsn_codes
  alter column description drop not null,
  drop constraint hsn_codes_description_check,
  add constraint hsn_codes_description_check
    check (description is null or char_length(trim(description)) between 1 and 300);

alter table public.items
  add column external_id text check (external_id is null or char_length(external_id) <= 100);

create unique index idx_items_external_id on public.items (external_id) where external_id is not null;

-- item_list selects i.*, expanded when the view is created, so it is recreated to
-- include external_id (same definition as in 20261104020000_inventory_adjustments.sql).
drop view public.item_list;

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
