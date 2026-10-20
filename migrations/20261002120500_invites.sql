-- Admin addresses that do not have an account yet (for the admin-invite function).
create or replace function public.admin_allowlist_without_account()
returns table (email text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.email from private.admin_allowlist a
  where not exists (select 1 from auth.users u where lower(u.email) = a.email);
$$;
revoke execute on function public.admin_allowlist_without_account() from public, anon, authenticated;
grant execute on function public.admin_allowlist_without_account() to service_role;
