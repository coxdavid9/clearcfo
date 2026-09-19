-- ClearCFO Step 4 hardening: pin the trigger function search_path.
create or replace function public.set_step4_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
