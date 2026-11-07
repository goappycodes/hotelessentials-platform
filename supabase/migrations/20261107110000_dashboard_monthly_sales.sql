-- The Dashboard's Sales Overview: quotations and sales orders per month, in India's time,
-- with every month present even when it had none. Runs as the caller, so someone who can't
-- see quotations or sales orders gets zeros for them.
create or replace function public.dashboard_monthly_sales(months integer default 6)
returns table (
  month date,
  quotation_count integer,
  quotation_total numeric,
  order_count integer,
  order_total numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with periods as (
    select (
      date_trunc('month', (now() at time zone 'Asia/Kolkata'))
      - make_interval(months => step)
    )::date as month
    from generate_series(0, least(greatest(months, 1), 24) - 1) step
  )
  select
    period.month,
    coalesce(quotes.quantity, 0)::integer,
    coalesce(quotes.total, 0),
    coalesce(orders.quantity, 0)::integer,
    coalesce(orders.total, 0)
  from periods period
  left join lateral (
    select count(*) as quantity, sum(q.total) as total
    from public.quotations q
    where q.quote_date >= period.month
      and q.quote_date < (period.month + interval '1 month')::date
  ) quotes on true
  left join lateral (
    select count(*) as quantity, sum(so.total) as total
    from public.sales_orders so
    where so.order_date >= period.month
      and so.order_date < (period.month + interval '1 month')::date
  ) orders on true
  order by period.month;
$$;

revoke all on function public.dashboard_monthly_sales(integer) from public, anon;
grant execute on function public.dashboard_monthly_sales(integer) to authenticated;
