-- Each quote line can take its price from a sales price list (the Discount column):
-- a cheaper list price shows as a percentage discount on the item's selling price.
alter table public.quotation_items
  add column price_list_id uuid references public.price_lists (id) on delete set null;

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
