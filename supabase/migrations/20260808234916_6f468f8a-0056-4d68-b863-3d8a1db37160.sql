create or replace function public.admin_bootstrap_super_admin(_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _role_id uuid;
  _admin_id uuid;
begin
  if exists (select 1 from public.admin_users) then
    raise exception 'An administrator already exists; bootstrap is closed.';
  end if;
  select id into _role_id from public.admin_roles where key = 'SUPER_ADMIN';
  if _role_id is null then
    raise exception 'SUPER_ADMIN role missing.';
  end if;
  insert into public.admin_users (user_id, role_id, active)
  values (_user_id, _role_id, true)
  returning id into _admin_id;
  return _admin_id;
end;
$$;

revoke all on function public.admin_bootstrap_super_admin(uuid) from public, anon, authenticated;
grant execute on function public.admin_bootstrap_super_admin(uuid) to service_role;