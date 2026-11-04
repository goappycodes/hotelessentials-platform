-- Images on the printed quotation: the business's logo and signature stamp, and item
-- pictures beside the lines.

alter table public.organization_settings
  add column logo_path text check (char_length(logo_path) <= 300),
  add column signature_path text check (char_length(signature_path) <= 300);

-- Private bucket; files are served through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Active users can view company files"
  on storage.objects for select to authenticated
  using (bucket_id = 'company-assets' and (select private.is_active_user()));

create policy "Admins can upload company files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'company-assets' and (select private.is_admin()));

create policy "Admins can delete company files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'company-assets' and (select private.is_admin()));

-- People who can view quotations see the pictures of the items on them.
alter policy "View item images" on public.item_images
  using (
    (select private.has_permission('items', 'view'))
    or (select private.has_permission('quotations', 'view'))
  );

alter policy "View item image files" on storage.objects
  using (
    bucket_id = 'item-images'
    and (
      (select private.has_permission('items', 'view'))
      or (select private.has_permission('quotations', 'view'))
    )
  );
