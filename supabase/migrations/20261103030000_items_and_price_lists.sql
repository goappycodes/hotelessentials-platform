-- Items (with HSN codes and images) and price lists, protected by module permissions.

-- Trigram search on item names. Created first: the index below depends on it.
create extension if not exists pg_trgm with schema extensions;

-- Items ---------------------------------------------------------------------

create type public.item_type as enum ('Goods', 'Service');

create type public.tax_preference as enum (
  'Taxable',
  'Non-Taxable',
  'Out of Scope',
  'Non-GST Supply'
);

create table public.hsn_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{4,8}$'),
  description text not null check (char_length(trim(description)) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger hsn_codes_set_updated_at
  before update on public.hsn_codes
  for each row execute function private.set_updated_at();

create table public.items (
  id uuid primary key default gen_random_uuid(),

  -- Basic information
  name text not null check (char_length(trim(name)) between 1 and 200),
  type public.item_type not null default 'Goods',
  unit text,
  sku text,
  hsn_code_id uuid references public.hsn_codes (id) on delete restrict,
  tax_preference public.tax_preference not null default 'Taxable',

  -- Sales information
  sales_enabled boolean not null default true,
  selling_price numeric(15, 2) not null default 0,
  sales_account text not null default 'Sales',
  sales_description text,

  -- Purchase information
  purchase_enabled boolean not null default true,
  cost_price numeric(15, 2) not null default 0,
  purchase_account text not null default 'Cost of Goods Sold',
  purchase_description text,
  preferred_vendor text,

  -- GST information
  intra_state_tax_rate numeric(5, 2) not null default 18.00,
  inter_state_tax_rate numeric(5, 2) not null default 18.00,

  -- Inventory
  track_inventory boolean not null default false,

  -- Status
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_selling_price check (selling_price >= 0),
  constraint valid_cost_price check (cost_price >= 0),
  constraint valid_intra_tax check (intra_state_tax_rate between 0 and 100),
  constraint valid_inter_tax check (inter_state_tax_rate between 0 and 100),
  constraint valid_hsn_for_goods check (type = 'Service' or hsn_code_id is not null)
);

create trigger items_set_updated_at
  before update on public.items
  for each row execute function private.set_updated_at();

-- Unique SKU when provided
create unique index idx_items_sku_unique
  on public.items (lower(sku))
  where sku is not null and sku <> '';

create index idx_items_name on public.items using gin (name extensions.gin_trgm_ops);
create index idx_items_hsn_code on public.items (hsn_code_id);
create index idx_items_type on public.items (type);
create index idx_items_active on public.items (is_active);

create table public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  file_size bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (item_id, storage_path)
);

create index idx_item_images_item on public.item_images (item_id);

-- Price lists ---------------------------------------------------------------

create type public.transaction_type as enum ('Sales', 'Purchase');

create type public.price_list_type as enum ('All Items', 'Individual Items');

create type public.percentage_type as enum ('Markup', 'Markdown');

create type public.round_off_type as enum (
  'Never mind',
  'Nearest whole number',
  '0.99',
  '0.50',
  '0.49',
  'Decimal Places'
);

create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  transaction_type public.transaction_type not null default 'Sales',
  price_list_type public.price_list_type not null default 'All Items',
  description text,
  percentage_type public.percentage_type,
  percentage_value numeric(10, 2),
  round_off_to public.round_off_type not null default 'Never mind',
  decimal_places smallint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_percentage_value check (
    percentage_value is null or percentage_value >= 0
  ),
  constraint valid_decimal_places check (
    decimal_places is null or decimal_places between 0 and 4
  ),
  constraint valid_percentage_configuration check (
    (
      price_list_type = 'All Items'
      and percentage_type is not null
      and percentage_value is not null
    )
    or (
      price_list_type = 'Individual Items'
      and percentage_type is null
      and percentage_value is null
    )
  ),
  constraint valid_rounding_configuration check (
    (round_off_to = 'Decimal Places' and decimal_places is not null)
    or (round_off_to <> 'Decimal Places' and decimal_places is null)
  )
);

create unique index idx_price_lists_name_unique on public.price_lists (lower(name));
create index idx_price_lists_transaction_type on public.price_lists (transaction_type);
create index idx_price_lists_active on public.price_lists (is_active);

create trigger price_lists_set_updated_at
  before update on public.price_lists
  for each row execute function private.set_updated_at();

create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  rate numeric(15, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_item_rate check (rate >= 0),
  unique (price_list_id, item_id)
);

-- The unique (price_list_id, item_id) index also serves lookups by price_list_id.
create index idx_price_list_items_item on public.price_list_items (item_id);

create trigger price_list_items_set_updated_at
  before update on public.price_list_items
  for each row execute function private.set_updated_at();

-- Row Level Security --------------------------------------------------------
-- Access follows module permissions (private.has_permission); owners and admins
-- always pass. Price list users can read items so item names show in their lists.

alter table public.hsn_codes enable row level security;
alter table public.items enable row level security;
alter table public.item_images enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;

revoke all on public.hsn_codes, public.items, public.item_images,
  public.price_lists, public.price_list_items from anon;

create policy "Active users can view HSN codes"
  on public.hsn_codes for select to authenticated
  using (private.is_active_user());

create policy "Item editors can add HSN codes"
  on public.hsn_codes for insert to authenticated
  with check (
    private.has_permission('items', 'create') or private.has_permission('items', 'edit')
  );

create policy "Admins can change HSN codes"
  on public.hsn_codes for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "Admins can delete HSN codes"
  on public.hsn_codes for delete to authenticated
  using (private.is_admin());

create policy "View items"
  on public.items for select to authenticated
  using (
    private.has_permission('items', 'view') or private.has_permission('price_lists', 'view')
  );

create policy "Create items"
  on public.items for insert to authenticated
  with check (private.has_permission('items', 'create'));

create policy "Edit items"
  on public.items for update to authenticated
  using (private.has_permission('items', 'edit'))
  with check (private.has_permission('items', 'edit'));

create policy "Delete items"
  on public.items for delete to authenticated
  using (private.has_permission('items', 'delete'));

create policy "View item images"
  on public.item_images for select to authenticated
  using (private.has_permission('items', 'view'));

create policy "Add item images"
  on public.item_images for insert to authenticated
  with check (
    private.has_permission('items', 'create') or private.has_permission('items', 'edit')
  );

create policy "Remove item images"
  on public.item_images for delete to authenticated
  using (private.has_permission('items', 'edit'));

create policy "View price lists"
  on public.price_lists for select to authenticated
  using (private.has_permission('price_lists', 'view'));

create policy "Create price lists"
  on public.price_lists for insert to authenticated
  with check (private.has_permission('price_lists', 'create'));

create policy "Edit price lists"
  on public.price_lists for update to authenticated
  using (private.has_permission('price_lists', 'edit'))
  with check (private.has_permission('price_lists', 'edit'));

create policy "Delete price lists"
  on public.price_lists for delete to authenticated
  using (private.has_permission('price_lists', 'delete'));

-- Item rates are part of a price list, so creating or editing the list covers them.
create policy "View price list items"
  on public.price_list_items for select to authenticated
  using (private.has_permission('price_lists', 'view'));

create policy "Add price list items"
  on public.price_list_items for insert to authenticated
  with check (
    private.has_permission('price_lists', 'create')
    or private.has_permission('price_lists', 'edit')
  );

create policy "Change price list items"
  on public.price_list_items for update to authenticated
  using (private.has_permission('price_lists', 'edit'))
  with check (private.has_permission('price_lists', 'edit'));

create policy "Remove price list items"
  on public.price_list_items for delete to authenticated
  using (
    private.has_permission('price_lists', 'create')
    or private.has_permission('price_lists', 'edit')
  );

-- Saving a price list ---------------------------------------------------------
-- Saves the list and replaces its item rates in one transaction. Runs as the caller
-- (security invoker), so the RLS policies above decide what is allowed.
-- item_rates: [{ "item_id": "<uuid>", "rate": 123.45 }], used for Individual Items.

create or replace function public.save_price_list(
  target_id uuid,
  name text,
  transaction_type public.transaction_type,
  price_list_type public.price_list_type,
  description text,
  percentage_type public.percentage_type,
  percentage_value numeric,
  round_off_to public.round_off_type,
  decimal_places smallint,
  is_active boolean,
  item_rates jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if target_id is null then
    insert into public.price_lists (
      name, transaction_type, price_list_type, description, percentage_type,
      percentage_value, round_off_to, decimal_places, is_active
    )
    values (
      trim(save_price_list.name),
      save_price_list.transaction_type,
      save_price_list.price_list_type,
      nullif(trim(save_price_list.description), ''),
      save_price_list.percentage_type,
      save_price_list.percentage_value,
      save_price_list.round_off_to,
      save_price_list.decimal_places,
      save_price_list.is_active
    )
    returning id into saved_id;
  else
    update public.price_lists pl
    set name = trim(save_price_list.name),
        transaction_type = save_price_list.transaction_type,
        price_list_type = save_price_list.price_list_type,
        description = nullif(trim(save_price_list.description), ''),
        percentage_type = save_price_list.percentage_type,
        percentage_value = save_price_list.percentage_value,
        round_off_to = save_price_list.round_off_to,
        decimal_places = save_price_list.decimal_places,
        is_active = save_price_list.is_active
    where pl.id = target_id
    returning pl.id into saved_id;

    if saved_id is null then
      raise exception 'This price list no longer exists.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.price_list_items pli where pli.price_list_id = saved_id;

  if save_price_list.price_list_type = 'Individual Items' then
    insert into public.price_list_items (price_list_id, item_id, rate)
    select saved_id, entry.item_id, entry.rate
    from jsonb_to_recordset(coalesce(item_rates, '[]'::jsonb))
      as entry (item_id uuid, rate numeric);
  end if;

  return saved_id;
end;
$$;

revoke all on function public.save_price_list(
  uuid, text, public.transaction_type, public.price_list_type, text,
  public.percentage_type, numeric, public.round_off_type, smallint, boolean, jsonb
) from public, anon;
grant execute on function public.save_price_list(
  uuid, text, public.transaction_type, public.price_list_type, text,
  public.percentage_type, numeric, public.round_off_type, smallint, boolean, jsonb
) to authenticated;

-- Item image storage --------------------------------------------------------
-- Private bucket; files are served through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "View item image files"
  on storage.objects for select to authenticated
  using (bucket_id = 'item-images' and private.has_permission('items', 'view'));

create policy "Upload item image files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (private.has_permission('items', 'create') or private.has_permission('items', 'edit'))
  );

create policy "Delete item image files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and private.has_permission('items', 'edit'));
