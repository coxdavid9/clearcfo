-- ClearCFO QuickBooks Online connection storage.
-- Tokens are encrypted by the application before they are stored.
create table if not exists public.quickbooks_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  realm_id text not null,
  company_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quickbooks_connections_user_id_idx
  on public.quickbooks_connections(user_id);

alter table public.quickbooks_connections enable row level security;

-- No client-facing policy is intentionally created. The ClearCFO server uses
-- the Supabase service-role key for this table so encrypted OAuth credentials
-- never need to be exposed to the browser.

create or replace function public.set_quickbooks_connection_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quickbooks_connections_updated_at on public.quickbooks_connections;
create trigger quickbooks_connections_updated_at
before update on public.quickbooks_connections
for each row execute function public.set_quickbooks_connection_updated_at();
