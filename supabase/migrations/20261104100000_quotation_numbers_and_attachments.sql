-- Quote numbers shown before saving, and files attached to quotations.

-- Quote numbers ---------------------------------------------------------------

-- The number the next new quotation gets (shown on New Quote). Only a preview: the
-- number is taken when the quotation is saved.
create or replace function public.next_quote_number()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  last_number bigint;
  used boolean;
begin
  if not private.has_permission('quotations', 'create') then
    return null;
  end if;
  select s.last_value, s.is_called into last_number, used from public.quotation_number_seq s;
  return 'QT-' || lpad((case when used then last_number + 1 else last_number end)::text, 6, '0');
end;
$$;

revoke all on function public.next_quote_number() from public, anon;
grant execute on function public.next_quote_number() to authenticated;

-- A blank quote number gets the next QT-000001-style number. A QT number typed by hand
-- that is ahead of the numbering moves it on, so later numbers don't repeat it.
create or replace function private.set_quote_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  typed bigint;
  last_number bigint;
  used boolean;
begin
  if new.quote_number is null or trim(new.quote_number) = '' then
    new.quote_number := 'QT-' || lpad(nextval('public.quotation_number_seq')::text, 6, '0');
  elsif upper(trim(new.quote_number)) ~ '^QT-[0-9]{1,15}$' then
    typed := substring(trim(new.quote_number) from 4)::bigint;
    select s.last_value, s.is_called into last_number, used from public.quotation_number_seq s;
    if typed > (case when used then last_number else last_number - 1 end) then
      perform setval('public.quotation_number_seq', typed, true);
    end if;
  end if;
  return new;
end;
$$;

-- Attachments -----------------------------------------------------------------

create table public.quotation_attachments (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  storage_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text,
  file_size bigint,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (quotation_id, storage_path)
);

create index idx_quotation_attachments_quotation on public.quotation_attachments (quotation_id);

alter table public.quotation_attachments enable row level security;
revoke all on public.quotation_attachments from anon;

create policy "Quotation viewers can view attachments"
  on public.quotation_attachments for select to authenticated
  using ((select private.has_permission('quotations', 'view')));

create policy "Quotation writers can add attachments"
  on public.quotation_attachments for insert to authenticated
  with check (
    (select private.has_permission('quotations', 'create'))
    or (select private.has_permission('quotations', 'edit'))
  );

create policy "Quotation editors can remove attachments"
  on public.quotation_attachments for delete to authenticated
  using (
    (select private.has_permission('quotations', 'edit'))
    or (select private.has_permission('quotations', 'delete'))
  );

-- Private bucket; files are served through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quotation-attachments',
  'quotation-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain'
  ]
)
on conflict (id) do nothing;

create policy "View quotation attachment files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'quotation-attachments'
    and (select private.has_permission('quotations', 'view'))
  );

create policy "Upload quotation attachment files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quotation-attachments'
    and (
      (select private.has_permission('quotations', 'create'))
      or (select private.has_permission('quotations', 'edit'))
    )
  );

create policy "Delete quotation attachment files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quotation-attachments'
    and (
      (select private.has_permission('quotations', 'edit'))
      or (select private.has_permission('quotations', 'delete'))
    )
  );
