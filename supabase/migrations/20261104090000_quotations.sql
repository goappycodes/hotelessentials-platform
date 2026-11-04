-- Quotations (Zoho "Estimates"): a customer, dates, salesperson, price list, line items
-- with discounts and GST, an adjustment and totals. Protected by the 'quotations'
-- module permissions. Also the business's GST state, which decides CGST + SGST
-- (same state as the place of supply) or IGST (another state).

-- Business settings (one row) --------------------------------------------------------

create table public.organization_settings (
  id boolean primary key default true check (id),
  -- GST state code of the business, e.g. '19' for West Bengal. Null until set.
  gst_state_code text check (gst_state_code is null or gst_state_code ~ '^[0-9]{2}$'),
  updated_at timestamptz not null default now()
);

insert into public.organization_settings (id) values (true);

create trigger organization_settings_set_updated_at
  before update on public.organization_settings
  for each row execute function private.set_updated_at();

alter table public.organization_settings enable row level security;
revoke all on public.organization_settings from anon;
revoke insert, delete on public.organization_settings from authenticated;

create policy "Active users can view organization settings"
  on public.organization_settings for select to authenticated
  using ((select private.is_active_user()));

create policy "Admins can change organization settings"
  on public.organization_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Quotations ---------------------------------------------------------------------------

create type public.quotation_status as enum ('Draft', 'Sent', 'Accepted', 'Declined');

-- Where a whole-quote discount applies: on the subtotal (Transaction) or per line.
create type public.discount_level as enum ('Transaction', 'Line Item');

create sequence public.quotation_number_seq;

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  -- QT-000001, filled in when left blank.
  quote_number text not null check (char_length(trim(quote_number)) between 1 and 30),
  reference_number text check (reference_number is null or char_length(reference_number) <= 50),
  customer_id uuid not null references public.customers (id) on delete restrict,
  -- The customer's display name when saved, for the list and search.
  customer_name text not null,
  quote_date date not null default current_date,
  expiry_date date,
  salesperson_id uuid references public.profiles (id) on delete set null,
  subject text check (subject is null or char_length(subject) <= 250),
  price_list_id uuid references public.price_lists (id) on delete set null,
  -- GST state code of the place of supply (from the customer); null for overseas.
  place_of_supply text check (place_of_supply is null or place_of_supply ~ '^[0-9]{2}$'),

  discount_level public.discount_level not null default 'Transaction',
  -- Transaction-level discount: a percentage or an amount.
  discount_value numeric(15, 4) not null default 0,
  discount_is_percent boolean not null default true,
  is_discount_before_tax boolean not null default true,
  adjustment numeric(15, 4) not null default 0,
  adjustment_description text check (adjustment_description is null or char_length(adjustment_description) <= 100),

  notes text check (notes is null or char_length(notes) <= 2000),
  terms text check (terms is null or char_length(terms) <= 5000),
  status public.quotation_status not null default 'Draft',

  -- Worked out by the app when saved (see lib/quotations.ts), stored for lists.
  sub_total numeric(15, 2) not null default 0,
  discount_total numeric(15, 2) not null default 0,
  tax_total numeric(15, 2) not null default 0,
  total numeric(15, 2) not null default 0,

  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_discount check (
    discount_value >= 0 and (not discount_is_percent or discount_value <= 100)
  ),
  constraint valid_expiry check (expiry_date is null or expiry_date >= quote_date)
);

create unique index idx_quotations_number on public.quotations (lower(quote_number));
create index idx_quotations_customer on public.quotations (customer_id);
create index idx_quotations_date on public.quotations (quote_date desc, created_at desc);
create index idx_quotations_status on public.quotations (status);
create index idx_quotations_customer_name on public.quotations using gin (customer_name extensions.gin_trgm_ops);

create trigger quotations_set_updated_at
  before update on public.quotations
  for each row execute function private.set_updated_at();

-- A blank quote number gets the next QT-000001-style number.
create or replace function private.set_quote_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quote_number is null or trim(new.quote_number) = '' then
    new.quote_number := 'QT-' || lpad(nextval('public.quotation_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

revoke all on function private.set_quote_number() from public;

create trigger quotations_set_number
  before insert on public.quotations
  for each row execute function private.set_quote_number();

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  -- The item it came from; the name and numbers below are kept even if the item changes.
  item_id uuid references public.items (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  hsn_code text check (hsn_code is null or char_length(hsn_code) <= 8),
  unit text check (unit is null or char_length(unit) <= 20),
  quantity numeric(15, 4) not null check (quantity > 0),
  rate numeric(15, 4) not null check (rate >= 0),
  discount_value numeric(15, 4) not null default 0,
  discount_is_percent boolean not null default true,
  tax_id uuid references public.tax_rates (id) on delete set null,
  -- The tax as it was when saved.
  tax_name text,
  tax_rate numeric(5, 2),
  -- Line amount after its own discount, before tax.
  amount numeric(15, 2) not null default 0,
  sort_order integer not null default 0,
  constraint valid_line_discount check (
    discount_value >= 0 and (not discount_is_percent or discount_value <= 100)
  )
);

create index idx_quotation_items_quotation on public.quotation_items (quotation_id);
create index idx_quotation_items_item on public.quotation_items (item_id);

-- Row level security (checks wrapped in (select …): run once per query) ----------------

alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
revoke all on public.quotations, public.quotation_items from anon;

create policy "View quotations"
  on public.quotations for select to authenticated
  using ((select private.has_permission('quotations', 'view')));

create policy "Create quotations"
  on public.quotations for insert to authenticated
  with check ((select private.has_permission('quotations', 'create')));

create policy "Edit quotations"
  on public.quotations for update to authenticated
  using ((select private.has_permission('quotations', 'edit')))
  with check ((select private.has_permission('quotations', 'edit')));

create policy "Delete quotations"
  on public.quotations for delete to authenticated
  using ((select private.has_permission('quotations', 'delete')));

-- Lines are part of the quotation, so creating or editing it covers them.
create policy "View quotation items"
  on public.quotation_items for select to authenticated
  using ((select private.has_permission('quotations', 'view')));

create policy "Add quotation items"
  on public.quotation_items for insert to authenticated
  with check (
    (select private.has_permission('quotations', 'create'))
    or (select private.has_permission('quotations', 'edit'))
  );

create policy "Remove quotation items"
  on public.quotation_items for delete to authenticated
  using (
    (select private.has_permission('quotations', 'create'))
    or (select private.has_permission('quotations', 'edit'))
  );

-- People making quotations pick customers, items and price lists, so they can see them.
alter policy "View customers" on public.customers
  using (
    (select private.has_permission('customers', 'view'))
    or (select private.has_permission('quotations', 'view'))
  );

alter policy "View items" on public.items
  using (
    (select private.has_permission('items', 'view'))
    or (select private.has_permission('price_lists', 'view'))
    or (select private.has_permission('inventory_adjustments', 'view'))
    or (select private.has_permission('quotations', 'view'))
  );

alter policy "View price lists" on public.price_lists
  using (
    (select private.has_permission('price_lists', 'view'))
    or (select private.has_permission('quotations', 'view'))
  );

alter policy "View price list items" on public.price_list_items
  using (
    (select private.has_permission('price_lists', 'view'))
    or (select private.has_permission('quotations', 'view'))
  );

-- Saving ------------------------------------------------------------------------------

-- Creates (target_id null) or updates a quotation and replaces its lines, in one
-- transaction. Runs as the caller, so the policies above apply. Totals are worked out
-- by the app and passed in. Returns the id.
create or replace function public.save_quotation(target_id uuid, quotation jsonb, items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
  q public.quotations;
  customer_display_name text;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Add at least one item.' using errcode = '23514';
  end if;

  q := jsonb_populate_record(null::public.quotations, quotation);

  select c.display_name into customer_display_name from public.customers c where c.id = q.customer_id;
  if customer_display_name is null then
    raise exception 'This customer no longer exists.' using errcode = '23503';
  end if;

  if target_id is null then
    insert into public.quotations (
      quote_number, reference_number, customer_id, customer_name, quote_date, expiry_date,
      salesperson_id, subject, price_list_id, place_of_supply, discount_level,
      discount_value, discount_is_percent, is_discount_before_tax, adjustment,
      adjustment_description, notes, terms, status, sub_total, discount_total, tax_total, total
    )
    values (
      nullif(trim(coalesce(q.quote_number, '')), ''), q.reference_number, q.customer_id,
      customer_display_name, q.quote_date, q.expiry_date, q.salesperson_id, q.subject,
      q.price_list_id, q.place_of_supply, q.discount_level, q.discount_value,
      q.discount_is_percent, q.is_discount_before_tax, q.adjustment, q.adjustment_description,
      q.notes, q.terms, coalesce(q.status, 'Draft'), q.sub_total, q.discount_total,
      q.tax_total, q.total
    )
    returning id into saved_id;
  else
    update public.quotations t
    set quote_number = coalesce(nullif(trim(coalesce(q.quote_number, '')), ''), t.quote_number),
        reference_number = q.reference_number,
        customer_id = q.customer_id,
        customer_name = customer_display_name,
        quote_date = q.quote_date,
        expiry_date = q.expiry_date,
        salesperson_id = q.salesperson_id,
        subject = q.subject,
        price_list_id = q.price_list_id,
        place_of_supply = q.place_of_supply,
        discount_level = q.discount_level,
        discount_value = q.discount_value,
        discount_is_percent = q.discount_is_percent,
        is_discount_before_tax = q.is_discount_before_tax,
        adjustment = q.adjustment,
        adjustment_description = q.adjustment_description,
        notes = q.notes,
        terms = q.terms,
        status = coalesce(q.status, t.status),
        sub_total = q.sub_total,
        discount_total = q.discount_total,
        tax_total = q.tax_total,
        total = q.total
    where t.id = target_id
    returning t.id into saved_id;

    if saved_id is null then
      raise exception 'This quotation no longer exists.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.quotation_items line where line.quotation_id = saved_id;

  insert into public.quotation_items (
    quotation_id, item_id, name, description, hsn_code, unit, quantity, rate,
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

revoke all on function public.save_quotation(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quotation(uuid, jsonb, jsonb) to authenticated;
