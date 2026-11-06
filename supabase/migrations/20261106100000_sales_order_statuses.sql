-- Sales orders go Draft → Confirmed → Closed. New orders start as Draft, and the orders
-- that were Open become Draft. Postgres can't drop enum values, so the type is replaced.

alter table public.sales_orders alter column status drop default;

alter type public.sales_order_status rename to sales_order_status_old;

create type public.sales_order_status as enum ('Draft', 'Confirmed', 'Closed');

alter table public.sales_orders
  alter column status type public.sales_order_status
  using (
    case status::text
      when 'Open' then 'Draft'
      when 'Cancelled' then 'Closed'
      else status::text
    end
  )::public.sales_order_status;

alter table public.sales_orders alter column status set default 'Draft';

drop type public.sales_order_status_old;
