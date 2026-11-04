-- SKUs don't have to be unique, like in Zoho Books: imported data has different items
-- sharing a SKU (e.g. two sizes of a tray). Imports match items by Item ID first.

drop index public.idx_items_sku_unique;

-- Still indexed for lookups (case-insensitive, as before).
create index idx_items_sku on public.items (lower(sku)) where sku is not null and sku <> '';
