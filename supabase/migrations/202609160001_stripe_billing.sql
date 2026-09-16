-- ClearCFO Stripe subscription state.
-- Stripe remains the source of truth for billing; this table is the app's
-- local entitlement cache used for Core/Pro feature gating.
create table if not exists public.stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text not null unique,
  price_id text,
  tier text not null check (tier in ('core', 'pro')),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_subscriptions_user_id_idx
  on public.stripe_subscriptions(user_id);

create index if not exists stripe_subscriptions_customer_id_idx
  on public.stripe_subscriptions(stripe_customer_id);

alter table public.stripe_subscriptions enable row level security;

-- No client-facing policy is intentionally created. The ClearCFO server uses
-- the Supabase service-role key for this table so billing state is only written
-- by authenticated checkout flows and verified Stripe webhooks.

create or replace function public.set_stripe_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stripe_subscriptions_updated_at on public.stripe_subscriptions;
create trigger stripe_subscriptions_updated_at
before update on public.stripe_subscriptions
for each row execute function public.set_stripe_subscription_updated_at();
