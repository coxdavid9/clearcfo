-- Run against Supabase SQL Editor; fixtures are rolled back.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000177');
do $$
declare first_id uuid; second_id uuid;
begin
  select id into first_id from public.ensure_initial_company('00000000-0000-4000-8000-000000000177', '{"companyName":"Initialization regression"}');
  select id into second_id from public.ensure_initial_company('00000000-0000-4000-8000-000000000177', '{"companyName":"Must not replace"}');
  if first_id <> second_id or (select count(*) from public.companies where created_by='00000000-0000-4000-8000-000000000177') <> 1 then
    raise exception 'Initialization must reuse the first business';
  end if;
  if (select count(*) from public.company_memberships where user_id='00000000-0000-4000-8000-000000000177') <> 1 then
    raise exception 'Initialization must create one membership';
  end if;
  if has_function_privilege('anon','public.ensure_initial_company(uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.ensure_initial_company(uuid,jsonb)','EXECUTE') then
    raise exception 'Client roles must not execute initializer';
  end if;
end;
$$;
rollback;
