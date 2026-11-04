-- Customer import from Zoho Books contacts exports: keep the source system's contact ID,
-- so importing the same file again skips customers already imported.

alter table public.customers
  add column external_id text check (external_id is null or char_length(external_id) <= 100);

create unique index idx_customers_external_id on public.customers (external_id)
  where external_id is not null;
