-- Server-only initialization: serialize per user across all app instances.
-- Explicit Add business remains separate and may create additional businesses.
create or replace function public.ensure_initial_company(p_user_id uuid, p_profile jsonb default '{}'::jsonb)
returns setof public.companies
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('initial-company:' || p_user_id::text, 0));
  select c.* into v_company
  from public.company_memberships m join public.companies c on c.id = m.company_id
  where m.user_id = p_user_id order by m.created_at, m.id limit 1;
  if found then
    return next v_company;
    return;
  end if;

  insert into public.companies(name, industry, company_size, contact_phone, created_by)
  values (
    coalesce(nullif(left(trim(p_profile->>'companyName'), 200), ''), 'My Business'),
    nullif(left(trim(p_profile->>'industry'), 200), ''),
    nullif(left(trim(p_profile->>'companySize'), 200), ''),
    nullif(left(trim(p_profile->>'contactPhone'), 200), ''), p_user_id
  ) returning * into v_company;
  insert into public.company_memberships(company_id, user_id, role)
  values (v_company.id, p_user_id, 'owner');
  return next v_company;
end;
$$;
revoke all on function public.ensure_initial_company(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ensure_initial_company(uuid, jsonb) to service_role;
