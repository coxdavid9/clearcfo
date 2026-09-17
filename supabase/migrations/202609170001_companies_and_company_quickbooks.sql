-- ClearCFO company architecture.
-- A user can belong to multiple companies; a company can have multiple members.
-- Core entitlement is enforced in application billing logic; this schema intentionally
-- supports multiple companies so Pro can add them without a database redesign.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  company_size text,
  contact_phone text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member', 'accountant')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists companies_created_by_idx
  on public.companies(created_by);

create index if not exists company_memberships_user_id_idx
  on public.company_memberships(user_id);

create index if not exists company_memberships_company_id_idx
  on public.company_memberships(company_id);

alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;

-- Server-side company access uses the Supabase service-role key. No client policy
-- is created here because company membership is security-sensitive application data.

-- Migrate the existing user-level company profile into a real company record.
-- The unique marker prevents duplicate migration if this migration is re-applied.
insert into public.companies (name, industry, company_size, contact_phone, created_by)
select
  coalesce(nullif(trim(u.raw_user_meta_data->>'companyName'), ''), 'My Business'),
  nullif(trim(u.raw_user_meta_data->>'industry'), ''),
  nullif(trim(u.raw_user_meta_data->>'companySize'), ''),
  nullif(trim(u.raw_user_meta_data->>'contactPhone'), ''),
  u.id
from auth.users u
where not exists (
  select 1
  from public.companies c
  where c.created_by = u.id
);

insert into public.company_memberships (company_id, user_id, role)
select c.id, c.created_by, 'owner'
from public.companies c
where not exists (
  select 1
  from public.company_memberships m
  where m.company_id = c.id and m.user_id = c.created_by
);

-- Associate existing QuickBooks connections with the migrated company.
alter table public.quickbooks_connections
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

update public.quickbooks_connections q
set company_id = m.company_id
from public.company_memberships m
where m.user_id = q.user_id
  and m.role = 'owner'
  and q.company_id is null;

-- Every existing connection must now belong to a company. New connections are
-- required to provide company_id. user_id remains as the user who authorized
-- the connection for audit/backward compatibility, but is no longer unique.
alter table public.quickbooks_connections
  alter column company_id set not null;

drop index if exists quickbooks_connections_user_id_idx;
alter table public.quickbooks_connections
  drop constraint if exists quickbooks_connections_user_id_key;

create index if not exists quickbooks_connections_user_id_idx
  on public.quickbooks_connections(user_id);

create unique index if not exists quickbooks_connections_company_id_unique
  on public.quickbooks_connections(company_id);

create index if not exists quickbooks_connections_realm_id_idx
  on public.quickbooks_connections(realm_id);

create or replace function public.set_companies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
before update on public.companies
for each row execute function public.set_companies_updated_at();
