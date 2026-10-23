-- Two-customer RLS regression: executed against live Supabase on 2026-10-23.
-- Test users, companies and subscriptions exist only inside this transaction.
-- The final ROLLBACK leaves no customer, subscription or financial data behind.
BEGIN;
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-8000-000000009185'),
  ('00000000-0000-4000-8000-000000009186');
INSERT INTO public.companies (id, name, created_by) VALUES
  ('10000000-0000-4000-8000-000000009185', 'Isolation test A', '00000000-0000-4000-8000-000000009185'),
  ('10000000-0000-4000-8000-000000009186', 'Isolation test B', '00000000-0000-4000-8000-000000009186');
INSERT INTO public.company_memberships (company_id, user_id, role) VALUES
  ('10000000-0000-4000-8000-000000009185', '00000000-0000-4000-8000-000000009185', 'owner'),
  ('10000000-0000-4000-8000-000000009186', '00000000-0000-4000-8000-000000009186', 'owner');
INSERT INTO public.subscriptions (user_id, plan, "interval", status) VALUES
  ('00000000-0000-4000-8000-000000009185', 'core', 'month', 'active'),
  ('00000000-0000-4000-8000-000000009186', 'pro', 'year', 'active');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009185', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.subscriptions WHERE user_id = '00000000-0000-4000-8000-000000009185') <> 1
     OR (SELECT count(*) FROM public.subscriptions WHERE user_id = '00000000-0000-4000-8000-000000009186') <> 0
     OR (SELECT count(*) FROM public.companies) <> 0
     OR (SELECT count(*) FROM public.company_memberships) <> 0
  THEN RAISE EXCEPTION 'Customer A isolation failed'; END IF;
END;
$$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009186', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.subscriptions WHERE user_id = '00000000-0000-4000-8000-000000009186') <> 1
     OR (SELECT count(*) FROM public.subscriptions WHERE user_id = '00000000-0000-4000-8000-000000009185') <> 0
     OR (SELECT count(*) FROM public.companies) <> 0
     OR (SELECT count(*) FROM public.company_memberships) <> 0
  THEN RAISE EXCEPTION 'Customer B isolation failed'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
-- Manual run PASS on 2026-10-23. This verifies direct Data API policy behavior;
-- application server routes must still check active company membership explicitly.
