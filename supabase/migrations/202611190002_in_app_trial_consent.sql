ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
