-- An item opened on the Inventory page shows its images, so inventory users can read them.

drop policy "View item images" on public.item_images;

create policy "View item images"
  on public.item_images for select to authenticated
  using (
    (select private.has_permission('items', 'view'))
    or (select private.has_permission('quotations', 'view'))
    or (select private.has_permission('sales_orders', 'view'))
    or (select private.has_permission('inventory_adjustments', 'view'))
  );

drop policy "View item image files" on storage.objects;

create policy "View item image files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'item-images'
    and (
      (select private.has_permission('items', 'view'))
      or (select private.has_permission('quotations', 'view'))
      or (select private.has_permission('sales_orders', 'view'))
      or (select private.has_permission('inventory_adjustments', 'view'))
    )
  );
