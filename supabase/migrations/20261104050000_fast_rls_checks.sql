-- Faster row level security: the same rules, with each permission check wrapped in
-- (select …). Postgres then runs it once per query (an initPlan) instead of once per row.
-- Unwrapped, a search over ~12,000 items ran the check ~36,000 times and took ~1.8 s
-- instead of ~0.3 s. See Supabase's "RLS performance" guide.
-- From now on, write policies with (select private.…(…)).

-- Profiles and permissions ---------------------------------------------------------

alter policy "Active users can view profiles" on public.profiles
  using (id = (select auth.uid()) or (select private.is_active_user()));

alter policy "Active users can update their own profile" on public.profiles
  using (id = (select auth.uid()) and (select private.is_active_user()))
  with check (id = (select auth.uid()));

alter policy "Users can view their own permissions; admins can view all" on public.user_permissions
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- HSN codes --------------------------------------------------------------------------

alter policy "Active users can view HSN codes" on public.hsn_codes
  using ((select private.is_active_user()));

alter policy "Item editors can add HSN codes" on public.hsn_codes
  with check (
    (select private.has_permission('items', 'create'))
    or (select private.has_permission('items', 'edit'))
  );

alter policy "Admins can change HSN codes" on public.hsn_codes
  using ((select private.is_admin())) with check ((select private.is_admin()));

alter policy "Admins can delete HSN codes" on public.hsn_codes
  using ((select private.is_admin()));

-- Items ------------------------------------------------------------------------------

alter policy "View items" on public.items
  using (
    (select private.has_permission('items', 'view'))
    or (select private.has_permission('price_lists', 'view'))
    or (select private.has_permission('inventory_adjustments', 'view'))
  );

alter policy "Create items" on public.items
  with check ((select private.has_permission('items', 'create')));

alter policy "Edit items" on public.items
  using ((select private.has_permission('items', 'edit')))
  with check ((select private.has_permission('items', 'edit')));

alter policy "Delete items" on public.items
  using ((select private.has_permission('items', 'delete')));

alter policy "View item images" on public.item_images
  using ((select private.has_permission('items', 'view')));

alter policy "Add item images" on public.item_images
  with check (
    (select private.has_permission('items', 'create'))
    or (select private.has_permission('items', 'edit'))
  );

alter policy "Remove item images" on public.item_images
  using ((select private.has_permission('items', 'edit')));

alter policy "View item image files" on storage.objects
  using (bucket_id = 'item-images' and (select private.has_permission('items', 'view')));

alter policy "Upload item image files" on storage.objects
  with check (
    bucket_id = 'item-images'
    and (
      (select private.has_permission('items', 'create'))
      or (select private.has_permission('items', 'edit'))
    )
  );

alter policy "Delete item image files" on storage.objects
  using (bucket_id = 'item-images' and (select private.has_permission('items', 'edit')));

-- Price lists ------------------------------------------------------------------------

alter policy "View price lists" on public.price_lists
  using ((select private.has_permission('price_lists', 'view')));

alter policy "Create price lists" on public.price_lists
  with check ((select private.has_permission('price_lists', 'create')));

alter policy "Edit price lists" on public.price_lists
  using ((select private.has_permission('price_lists', 'edit')))
  with check ((select private.has_permission('price_lists', 'edit')));

alter policy "Delete price lists" on public.price_lists
  using ((select private.has_permission('price_lists', 'delete')));

alter policy "View price list items" on public.price_list_items
  using ((select private.has_permission('price_lists', 'view')));

alter policy "Add price list items" on public.price_list_items
  with check (
    (select private.has_permission('price_lists', 'create'))
    or (select private.has_permission('price_lists', 'edit'))
  );

alter policy "Change price list items" on public.price_list_items
  using ((select private.has_permission('price_lists', 'edit')))
  with check ((select private.has_permission('price_lists', 'edit')));

alter policy "Remove price list items" on public.price_list_items
  using (
    (select private.has_permission('price_lists', 'create'))
    or (select private.has_permission('price_lists', 'edit'))
  );

-- Taxes ------------------------------------------------------------------------------

alter policy "Active users can view tax rates" on public.tax_rates
  using ((select private.is_active_user()));

alter policy "Admins can add tax rates" on public.tax_rates
  with check ((select private.is_admin()));

alter policy "Admins can change tax rates" on public.tax_rates
  using ((select private.is_admin())) with check ((select private.is_admin()));

alter policy "Admins can delete tax rates" on public.tax_rates
  using ((select private.is_admin()));

-- Inventory adjustments --------------------------------------------------------------

alter policy "View inventory adjustments" on public.inventory_adjustments
  using ((select private.has_permission('inventory_adjustments', 'view')));

alter policy "Create inventory adjustments" on public.inventory_adjustments
  with check ((select private.has_permission('inventory_adjustments', 'create')));

alter policy "Edit inventory adjustments" on public.inventory_adjustments
  using ((select private.has_permission('inventory_adjustments', 'edit')))
  with check ((select private.has_permission('inventory_adjustments', 'edit')));

alter policy "Delete inventory adjustments" on public.inventory_adjustments
  using ((select private.has_permission('inventory_adjustments', 'delete')));

alter policy "Item viewers can view adjusted adjustments" on public.inventory_adjustments
  using (status = 'Adjusted' and (select private.has_permission('items', 'view')));

alter policy "View inventory adjustment items" on public.inventory_adjustment_items
  using (
    (select private.has_permission('inventory_adjustments', 'view'))
    or (select private.has_permission('items', 'view'))
  );

alter policy "Add inventory adjustment items" on public.inventory_adjustment_items
  with check (
    (select private.has_permission('inventory_adjustments', 'create'))
    or (select private.has_permission('inventory_adjustments', 'edit'))
  );

alter policy "Edit inventory adjustment items" on public.inventory_adjustment_items
  using ((select private.has_permission('inventory_adjustments', 'edit')))
  with check ((select private.has_permission('inventory_adjustments', 'edit')));

alter policy "Remove inventory adjustment items" on public.inventory_adjustment_items
  using ((select private.has_permission('inventory_adjustments', 'edit')));
