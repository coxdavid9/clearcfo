-- Persist the last QuickBooks sync state so customers can see when their
-- financial data was last refreshed and whether the most recent sync failed.
create table if not exists public.quickbooks_sync_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'never_synced' check (status in ('never_synced', 'syncing', 'success', 'error')),
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists quickbooks_sync_status_user_id_idx
  on public.quickbooks_sync_status(user_id);

alter table public.quickbooks_sync_status enable row level security;

-- The server uses the Supabase service-role key. Sync state is never exposed
-- through a direct client query.
create or replace function public.set_quickbooks_sync_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quickbooks_sync_status_updated_at on public.quickbooks_sync_status;
create trigger quickbooks_sync_status_updated_at
before update on public.quickbooks_sync_status
for each row execute function public.set_quickbooks_sync_status_updated_at();
