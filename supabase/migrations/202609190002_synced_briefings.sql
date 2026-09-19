-- ClearCFO Step 4b: server-side storage for the latest synced briefing.
-- The scheduler has no browser and no localStorage, so it persists each
-- company's newest briefing here; the dashboard reads it back.
-- Service-role access only, same pattern as companies / quickbooks_connections.

create table if not exists public.synced_briefings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  briefing jsonb not null,
  synced_at timestamptz not null default now()
);

alter table public.synced_briefings enable row level security;

-- No client policies: briefings contain full company financials and are
-- security-sensitive application data, accessed server-side only.
