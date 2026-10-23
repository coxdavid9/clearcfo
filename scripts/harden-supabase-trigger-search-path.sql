-- ClearCFO: harden the two SECURITY INVOKER updated_at triggers.
-- Safe, no data or owner/privilege changes. Run once in Supabase SQL editor.
-- pg_catalog.now() remains available when search_path is empty.
BEGIN;
ALTER FUNCTION public.set_companies_updated_at() SET search_path = '';
ALTER FUNCTION public.set_quickbooks_connection_updated_at() SET search_path = '';
COMMIT;

-- Verify with Supabase Security Advisor (function_search_path_mutable).
