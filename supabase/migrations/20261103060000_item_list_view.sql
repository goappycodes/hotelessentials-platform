-- Items with their HSN code as a plain column, so the items list and search can match
-- name, SKU and HSN code in one query. security_invoker makes the view apply the caller's
-- RLS on items and hsn_codes.
-- Note: `i.*` is expanded when the view is created; recreate the view after adding
-- columns to public.items.

create view public.item_list
with (security_invoker = true)
as
select i.*, h.code as hsn_code
from public.items i
left join public.hsn_codes h on h.id = i.hsn_code_id;

revoke all on public.item_list from anon;
grant select on public.item_list to authenticated;

-- Speeds up "contains" searches on SKU and HSN code (names already have one).
create index idx_items_sku_trgm on public.items using gin (sku extensions.gin_trgm_ops);
create index idx_hsn_codes_code_trgm on public.hsn_codes using gin (code extensions.gin_trgm_ops);
