-- Customers, like Zoho Books' New Customer form: primary contact, GST details, billing
-- and shipping addresses, extra contact persons and remarks. Protected by the
-- 'customers' module permissions (20261104060000_customers_module.sql).

create type public.customer_type as enum ('Business', 'Individual');

create type public.gst_treatment as enum (
  'Registered Business - Regular',
  'Registered Business - Composition',
  'Unregistered Business',
  'Consumer',
  'Overseas',
  'Special Economic Zone',
  'Deemed Export',
  'Tax Deductor',
  'SEZ Developer'
);

create type public.customer_tax_preference as enum ('Taxable', 'Tax Exempt');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_type public.customer_type not null default 'Business',

  -- Primary contact
  salutation text check (salutation is null or char_length(salutation) <= 20),
  first_name text check (first_name is null or char_length(first_name) <= 100),
  last_name text check (last_name is null or char_length(last_name) <= 100),
  company_name text check (company_name is null or char_length(company_name) <= 200),
  display_name text not null check (char_length(trim(display_name)) between 1 and 200),
  email text check (email is null or char_length(email) <= 254),
  work_phone text check (work_phone is null or char_length(work_phone) <= 30),
  mobile text check (mobile is null or char_length(mobile) <= 30),
  language text not null default 'English' check (char_length(language) <= 30),

  -- Other details
  gst_treatment public.gst_treatment,
  -- 15-character GSTIN, e.g. 19AABCU9603R1ZM.
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  -- GST state code, e.g. '19' for West Bengal.
  place_of_supply text check (place_of_supply is null or place_of_supply ~ '^[0-9]{2}$'),
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  tax_preference public.customer_tax_preference not null default 'Taxable',
  exemption_reason text check (exemption_reason is null or char_length(exemption_reason) <= 200),
  accounts_receivable text not null default 'Accounts Receivable',
  opening_balance numeric(15, 4) not null default 0,
  payment_terms text not null default 'Due on Receipt' check (char_length(payment_terms) <= 50),
  price_list_id uuid references public.price_lists (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null default auth.uid(),

  -- Billing address
  billing_attention text check (billing_attention is null or char_length(billing_attention) <= 100),
  billing_country text check (billing_country is null or char_length(billing_country) <= 60),
  billing_street1 text check (billing_street1 is null or char_length(billing_street1) <= 200),
  billing_street2 text check (billing_street2 is null or char_length(billing_street2) <= 200),
  billing_city text check (billing_city is null or char_length(billing_city) <= 100),
  billing_state text check (billing_state is null or char_length(billing_state) <= 100),
  billing_pin_code text check (billing_pin_code is null or char_length(billing_pin_code) <= 20),
  billing_phone text check (billing_phone is null or char_length(billing_phone) <= 30),
  billing_fax text check (billing_fax is null or char_length(billing_fax) <= 30),

  -- Shipping address
  shipping_attention text check (shipping_attention is null or char_length(shipping_attention) <= 100),
  shipping_country text check (shipping_country is null or char_length(shipping_country) <= 60),
  shipping_street1 text check (shipping_street1 is null or char_length(shipping_street1) <= 200),
  shipping_street2 text check (shipping_street2 is null or char_length(shipping_street2) <= 200),
  shipping_city text check (shipping_city is null or char_length(shipping_city) <= 100),
  shipping_state text check (shipping_state is null or char_length(shipping_state) <= 100),
  shipping_pin_code text check (shipping_pin_code is null or char_length(shipping_pin_code) <= 20),
  shipping_phone text check (shipping_phone is null or char_length(shipping_phone) <= 30),
  shipping_fax text check (shipping_fax is null or char_length(shipping_fax) <= 30),

  remarks text check (remarks is null or char_length(remarks) <= 1000),
  is_active boolean not null default true,

  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_opening_balance check (opening_balance >= 0),
  -- Registered businesses (and similar) are identified by their GSTIN.
  constraint gstin_for_registered check (
    gstin is not null or gst_treatment is null or gst_treatment in (
      'Unregistered Business', 'Consumer', 'Overseas'
    )
  ),
  constraint exemption_reason_for_exempt check (
    tax_preference = 'Taxable' or exemption_reason is not null
  )
);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();

create index idx_customers_display_name on public.customers using gin (display_name extensions.gin_trgm_ops);
create index idx_customers_company_name on public.customers using gin (company_name extensions.gin_trgm_ops);
create index idx_customers_active on public.customers (is_active);
create index idx_customers_price_list on public.customers (price_list_id);

-- Other people at the customer (Zoho's "Contact Persons").
create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  salutation text check (salutation is null or char_length(salutation) <= 20),
  first_name text check (first_name is null or char_length(first_name) <= 100),
  last_name text check (last_name is null or char_length(last_name) <= 100),
  email text check (email is null or char_length(email) <= 254),
  work_phone text check (work_phone is null or char_length(work_phone) <= 30),
  mobile text check (mobile is null or char_length(mobile) <= 30),
  sort_order integer not null default 0,
  constraint contact_has_a_name_or_way_to_reach check (
    coalesce(first_name, last_name, email, work_phone, mobile) is not null
  )
);

create index idx_customer_contacts_customer on public.customer_contacts (customer_id);

-- Row level security (checks wrapped in (select …): run once per query) ----------------

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;

revoke all on public.customers, public.customer_contacts from anon;

create policy "View customers"
  on public.customers for select to authenticated
  using ((select private.has_permission('customers', 'view')));

create policy "Create customers"
  on public.customers for insert to authenticated
  with check ((select private.has_permission('customers', 'create')));

create policy "Edit customers"
  on public.customers for update to authenticated
  using ((select private.has_permission('customers', 'edit')))
  with check ((select private.has_permission('customers', 'edit')));

create policy "Delete customers"
  on public.customers for delete to authenticated
  using ((select private.has_permission('customers', 'delete')));

-- Contact persons are part of the customer, so creating or editing it covers them.
create policy "View customer contacts"
  on public.customer_contacts for select to authenticated
  using ((select private.has_permission('customers', 'view')));

create policy "Add customer contacts"
  on public.customer_contacts for insert to authenticated
  with check (
    (select private.has_permission('customers', 'create'))
    or (select private.has_permission('customers', 'edit'))
  );

create policy "Remove customer contacts"
  on public.customer_contacts for delete to authenticated
  using (
    (select private.has_permission('customers', 'create'))
    or (select private.has_permission('customers', 'edit'))
  );

-- Saving --------------------------------------------------------------------------------

-- Creates (target_id null) or updates a customer and replaces its contact persons, in one
-- transaction. Runs as the caller, so the policies above apply.
-- customer: the customers columns as JSON (id, created_by and timestamps are ignored).
-- contacts: [{ salutation, first_name, last_name, email, work_phone, mobile }].
create or replace function public.save_customer(target_id uuid, customer jsonb, contacts jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
  row_values public.customers;
begin
  row_values := jsonb_populate_record(null::public.customers, customer);

  if target_id is null then
    insert into public.customers (
      customer_type, salutation, first_name, last_name, company_name, display_name, email,
      work_phone, mobile, language, gst_treatment, gstin, place_of_supply, pan,
      tax_preference, exemption_reason, opening_balance, payment_terms, price_list_id,
      owner_id, billing_attention, billing_country, billing_street1, billing_street2,
      billing_city, billing_state, billing_pin_code, billing_phone, billing_fax,
      shipping_attention, shipping_country, shipping_street1, shipping_street2,
      shipping_city, shipping_state, shipping_pin_code, shipping_phone, shipping_fax,
      remarks, is_active
    )
    values (
      row_values.customer_type, row_values.salutation, row_values.first_name,
      row_values.last_name, row_values.company_name, trim(row_values.display_name),
      row_values.email, row_values.work_phone, row_values.mobile, row_values.language,
      row_values.gst_treatment, row_values.gstin, row_values.place_of_supply, row_values.pan,
      row_values.tax_preference, row_values.exemption_reason, row_values.opening_balance,
      row_values.payment_terms, row_values.price_list_id,
      coalesce(row_values.owner_id, (select auth.uid())),
      row_values.billing_attention, row_values.billing_country, row_values.billing_street1,
      row_values.billing_street2, row_values.billing_city, row_values.billing_state,
      row_values.billing_pin_code, row_values.billing_phone, row_values.billing_fax,
      row_values.shipping_attention, row_values.shipping_country, row_values.shipping_street1,
      row_values.shipping_street2, row_values.shipping_city, row_values.shipping_state,
      row_values.shipping_pin_code, row_values.shipping_phone, row_values.shipping_fax,
      row_values.remarks, coalesce(row_values.is_active, true)
    )
    returning id into saved_id;
  else
    update public.customers c
    set customer_type = row_values.customer_type,
        salutation = row_values.salutation,
        first_name = row_values.first_name,
        last_name = row_values.last_name,
        company_name = row_values.company_name,
        display_name = trim(row_values.display_name),
        email = row_values.email,
        work_phone = row_values.work_phone,
        mobile = row_values.mobile,
        language = row_values.language,
        gst_treatment = row_values.gst_treatment,
        gstin = row_values.gstin,
        place_of_supply = row_values.place_of_supply,
        pan = row_values.pan,
        tax_preference = row_values.tax_preference,
        exemption_reason = row_values.exemption_reason,
        opening_balance = row_values.opening_balance,
        payment_terms = row_values.payment_terms,
        price_list_id = row_values.price_list_id,
        owner_id = row_values.owner_id,
        billing_attention = row_values.billing_attention,
        billing_country = row_values.billing_country,
        billing_street1 = row_values.billing_street1,
        billing_street2 = row_values.billing_street2,
        billing_city = row_values.billing_city,
        billing_state = row_values.billing_state,
        billing_pin_code = row_values.billing_pin_code,
        billing_phone = row_values.billing_phone,
        billing_fax = row_values.billing_fax,
        shipping_attention = row_values.shipping_attention,
        shipping_country = row_values.shipping_country,
        shipping_street1 = row_values.shipping_street1,
        shipping_street2 = row_values.shipping_street2,
        shipping_city = row_values.shipping_city,
        shipping_state = row_values.shipping_state,
        shipping_pin_code = row_values.shipping_pin_code,
        shipping_phone = row_values.shipping_phone,
        shipping_fax = row_values.shipping_fax,
        remarks = row_values.remarks,
        is_active = coalesce(row_values.is_active, true)
    where c.id = target_id
    returning c.id into saved_id;

    if saved_id is null then
      raise exception 'This customer no longer exists.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.customer_contacts cc where cc.customer_id = saved_id;

  insert into public.customer_contacts (
    customer_id, salutation, first_name, last_name, email, work_phone, mobile, sort_order
  )
  select saved_id, entry.salutation, entry.first_name, entry.last_name, entry.email,
    entry.work_phone, entry.mobile, entry.position - 1
  from rows from (
    jsonb_to_recordset(coalesce(contacts, '[]'::jsonb)) as (
      salutation text, first_name text, last_name text, email text, work_phone text,
      mobile text
    )
  ) with ordinality as entry (
    salutation, first_name, last_name, email, work_phone, mobile, position
  );

  return saved_id;
end;
$$;

revoke all on function public.save_customer(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_customer(uuid, jsonb, jsonb) to authenticated;
