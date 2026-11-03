-- Locking an item stops it being changed or deleted until it is unlocked.
-- Only owners and admins can lock or unlock.

alter table public.items add column is_locked boolean not null default false;

create or replace function private.guard_locked_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_locked then
      raise exception 'This item is locked. Unlock it before deleting it.' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.is_locked is distinct from old.is_locked and not private.is_admin() then
    raise exception 'Only owners and admins can lock or unlock items.' using errcode = '42501';
  end if;

  -- While locked (and staying locked), nothing else may change.
  if old.is_locked and new.is_locked
    and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    raise exception 'This item is locked. Unlock it before making changes.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_locked_item() from public;

create trigger items_guard_locked
  before update or delete on public.items
  for each row execute function private.guard_locked_item();
