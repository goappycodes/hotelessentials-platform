-- Discounts from price lists are percentages like 9.99918605%, so the line comes to the
-- list price to the paisa; 4 decimals weren't enough on large amounts.
alter table public.quotation_items
  alter column discount_value type numeric(18, 8);
