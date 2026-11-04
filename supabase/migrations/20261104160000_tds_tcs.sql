-- TDS and TCS on quotations, like Zoho: a rate picked under the sub total. TDS (tax
-- deducted at source) comes off the total; TCS (tax collected at source) is added.

create type public.direct_tax_kind as enum ('TDS', 'TCS');

-- Settings → Direct Taxes: the TDS and TCS rates quotations pick from.
create table public.direct_tax_rates (
  id uuid primary key default gen_random_uuid(),
  kind public.direct_tax_kind not null,
  name text not null check (char_length(trim(name)) between 1 and 100),
  rate numeric(5, 2) not null check (rate >= 0 and rate <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_direct_tax_rates_name on public.direct_tax_rates (kind, lower(name));

alter table public.direct_tax_rates enable row level security;
revoke all on public.direct_tax_rates from anon;

create policy "Active users can view direct tax rates"
  on public.direct_tax_rates for select to authenticated
  using ((select private.is_active_user()));

create policy "Admins can add direct tax rates"
  on public.direct_tax_rates for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins can change direct tax rates"
  on public.direct_tax_rates for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Admins can delete direct tax rates"
  on public.direct_tax_rates for delete to authenticated
  using ((select private.is_admin()));

-- Zoho's standard TDS rates.
insert into public.direct_tax_rates (kind, name, rate) values
  ('TDS', 'Commission or Brokerage', 2),
  ('TDS', 'Commission or Brokerage (Reduced)', 3.75),
  ('TDS', 'Dividend', 10),
  ('TDS', 'Dividend (Reduced)', 7.5),
  ('TDS', 'Other Interest than securities', 10),
  ('TDS', 'Other Interest than securities (Reduced)', 7.5),
  ('TDS', 'Payment of contractors for Others', 2),
  ('TDS', 'Payment of contractors for Others (Reduced)', 1.5),
  ('TDS', 'Payment of contractors HUF/Indiv', 1),
  ('TDS', 'Payment of contractors HUF/Indiv (Reduced)', 0.75),
  ('TDS', 'Professional Fees', 10),
  ('TDS', 'Professional Fees (Reduced)', 7.5),
  ('TDS', 'Rent on land or furniture etc', 10),
  ('TDS', 'Rent on land or furniture etc (Reduced)', 7.5),
  ('TDS', 'Technical Fees (2%)', 2);

alter table public.quotations
  add column tax_deduction_type public.direct_tax_kind not null default 'TDS',
  add column direct_tax_id uuid references public.direct_tax_rates (id) on delete set null,
  add column direct_tax_name text,
  add column direct_tax_rate numeric(5, 2),
  -- Always positive: taken off the total for TDS, added for TCS.
  add column direct_tax_amount numeric(15, 2) not null default 0 check (direct_tax_amount >= 0);

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
  direct_tax public.direct_tax_rates;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Add at least one item.' using errcode = '23514';
  end if;

  q := jsonb_populate_record(null::public.quotations, quotation);

  select c.display_name into customer_display_name from public.customers c where c.id = q.customer_id;
  if customer_display_name is null then
    raise exception 'This customer no longer exists.' using errcode = '23503';
  end if;

  -- TDS or TCS: the rate's name and percentage are kept with the quotation.
  q.tax_deduction_type := coalesce(q.tax_deduction_type, 'TDS');
  if q.direct_tax_id is not null then
    select d.* into direct_tax from public.direct_tax_rates d where d.id = q.direct_tax_id;
    if direct_tax.id is null or direct_tax.kind <> q.tax_deduction_type then
      raise exception 'Pick a % tax again.', q.tax_deduction_type using errcode = '23503';
    end if;
  else
    q.direct_tax_amount := 0;
  end if;

  if target_id is null then
    insert into public.quotations (
      quote_number, reference_number, customer_id, customer_name, quote_date, expiry_date,
      salesperson_id, subject, price_list_id, place_of_supply, discount_level,
      discount_value, discount_is_percent, is_discount_before_tax, adjustment,
      adjustment_description, notes, terms, status, sub_total, discount_total, tax_total, total,
      tax_deduction_type, direct_tax_id, direct_tax_name, direct_tax_rate, direct_tax_amount
    )
    values (
      nullif(trim(coalesce(q.quote_number, '')), ''), q.reference_number, q.customer_id,
      customer_display_name, q.quote_date, q.expiry_date, q.salesperson_id, q.subject,
      q.price_list_id, q.place_of_supply, q.discount_level, q.discount_value,
      q.discount_is_percent, q.is_discount_before_tax, q.adjustment, q.adjustment_description,
      q.notes, q.terms, coalesce(q.status, 'Draft'), q.sub_total, q.discount_total,
      q.tax_total, q.total, q.tax_deduction_type, q.direct_tax_id, direct_tax.name,
      direct_tax.rate, coalesce(q.direct_tax_amount, 0)
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
        total = q.total,
        tax_deduction_type = q.tax_deduction_type,
        direct_tax_id = q.direct_tax_id,
        direct_tax_name = direct_tax.name,
        direct_tax_rate = direct_tax.rate,
        direct_tax_amount = coalesce(q.direct_tax_amount, 0)
    where t.id = target_id
    returning t.id into saved_id;

    if saved_id is null then
      raise exception 'This quotation no longer exists.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.quotation_items line where line.quotation_id = saved_id;

  insert into public.quotation_items (
    quotation_id, item_id, name, description, hsn_code, unit, quantity, rate,
    discount_value, discount_is_percent, price_list_id, tax_id, tax_name, tax_rate, amount,
    sort_order
  )
  select saved_id, entry.item_id, trim(entry.name), entry.description, entry.hsn_code,
    entry.unit, entry.quantity, entry.rate, coalesce(entry.discount_value, 0),
    coalesce(entry.discount_is_percent, true), entry.price_list_id, entry.tax_id, tax.name, tax.rate,
    entry.amount, entry.position - 1
  from rows from (
    jsonb_to_recordset(items) as (
      item_id uuid, name text, description text, hsn_code text, unit text,
      quantity numeric, rate numeric, discount_value numeric, discount_is_percent boolean,
      price_list_id uuid, tax_id uuid, amount numeric
    )
  ) with ordinality as entry (
    item_id, name, description, hsn_code, unit, quantity, rate, discount_value,
    discount_is_percent, price_list_id, tax_id, amount, position
  )
  left join public.tax_rates tax on tax.id = entry.tax_id;

  return saved_id;
end;
$$;

revoke all on function public.save_quotation(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quotation(uuid, jsonb, jsonb) to authenticated;
