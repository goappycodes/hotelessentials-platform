-- A Customers module (Sales → Customers), with its own view/create/edit/delete
-- permissions. Its tables come later; this only allows the permission rows.

alter table public.user_permissions drop constraint user_permissions_module_check;

alter table public.user_permissions
  add constraint user_permissions_module_check check (
    module in (
      'items', 'price_lists', 'inventory_adjustments', 'customers', 'quotations',
      'sales_orders', 'despatch', 'reports'
    )
  );
