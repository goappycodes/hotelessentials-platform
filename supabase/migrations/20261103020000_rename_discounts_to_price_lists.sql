-- The Discounts module is now called Price Lists. Same behaviour, new module key.

alter table public.user_permissions drop constraint user_permissions_module_check;

update public.user_permissions
set module = 'price_lists'
where module = 'discounts';

alter table public.user_permissions
  add constraint user_permissions_module_check check (
    module in ('items', 'price_lists', 'quotations', 'sales_orders', 'despatch', 'reports')
  );
