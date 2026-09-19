-- ClearCFO Step 4: alert rules, alert history, and notification preferences.
-- Server-side only: the app accesses these tables with the Supabase
-- service-role key (same pattern as companies / quickbooks_connections).
-- No client RLS policies are created here.

create table if not exists public.notification_preferences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  alerts_enabled boolean not null default true,
  weekly_report_enabled boolean not null default true,
  -- 1 = Monday .. 7 = Sunday. The scheduler also checks this as a backstop.
  weekly_report_day smallint not null default 1 check (weekly_report_day between 1 and 7),
  report_recipient_email text,
  auto_sync_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  metric text not null check (metric in ('cash', 'grossMargin', 'revenue', 'operatingExpense', 'inventory')),
  operator text not null check (operator in ('below', 'above')),
  -- Dollars for cash / revenue / operatingExpense / inventory;
  -- percentage points for grossMargin.
  value numeric not null,
  severity text not null default 'medium' check (severity in ('high', 'medium', 'watch')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alert_rules_company_idx
  on public.alert_rules(company_id);

-- Dedupe log: the job layer skips an alert_key already sent recently
-- (7-day window) unless its severity escalated.
create table if not exists public.alert_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  alert_key text not null,
  rule_id text,
  severity text not null check (severity in ('high', 'medium', 'watch')),
  title text not null,
  detail text,
  estimated_impact numeric,
  sent_at timestamptz not null default now()
);

create index if not exists alert_history_company_key_idx
  on public.alert_history(company_id, alert_key, sent_at desc);

alter table public.notification_preferences enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_history enable row level security;

create or replace function public.set_step4_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_step4_updated_at();

drop trigger if exists alert_rules_updated_at on public.alert_rules;
create trigger alert_rules_updated_at
before update on public.alert_rules
for each row execute function public.set_step4_updated_at();
