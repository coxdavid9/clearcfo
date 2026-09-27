create table public.excel_analyses (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  created_at timestamptz not null default now()
);

create index excel_analyses_user_id_idx on public.excel_analyses(user_id);
alter table public.excel_analyses enable row level security;
