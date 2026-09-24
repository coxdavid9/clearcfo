create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('core','pro')),
  interval text not null check (interval in ('month','year')),
  status text not null check (status in ('trialing','active','past_due','canceled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  is_comp boolean not null default false,
  trial_email_day0_sent_at timestamptz,
  trial_email_day2_sent_at timestamptz,
  trial_email_day5_sent_at timestamptz,
  trial_email_day7_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_stripe_customer_idx on public.subscriptions(stripe_customer_id);
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select using (auth.uid() = user_id);
