-- The employees' suggestions for the website, sent from the unlisted /forslag page through the submit-suggestion
-- Edge Function and read in the admin (Hemsidan → Förslag). Only the status can change afterwards.

create table public.site_suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  -- Which part of the website it is about, as the sender chose it.
  area text not null default '' check (char_length(area) <= 120),
  message text not null check (char_length(message) between 1 and 3000),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  -- A one-way hash of the sender's address, only to limit how often one sender can send.
  sender_hash text not null default '',
  created_at timestamptz not null default now()
);
create index site_suggestions_created_idx on public.site_suggestions (created_at desc);
create index site_suggestions_sender_idx on public.site_suggestions (sender_hash, created_at);
alter table public.site_suggestions enable row level security;
create policy "Admins read suggestions" on public.site_suggestions for select to authenticated using ((select public.is_admin()));
create policy "Admins mark suggestions" on public.site_suggestions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete suggestions" on public.site_suggestions for delete to authenticated using ((select public.is_admin()));

create or replace function private.site_suggestions_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.name, new.area, new.message, new.created_at, new.sender_hash) is distinct from (old.name, old.area, old.message, old.created_at, old.sender_hash) then
    raise exception 'A suggestion''s content cannot be changed' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger site_suggestions_guard before update on public.site_suggestions for each row execute function private.site_suggestions_guard();

-- Stores a suggestion, with a limit per sender.
create or replace function public.insert_site_suggestion(p_name text, p_area text, p_message text, p_sender_hash text, p_max_per_hour int default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
  suggestion_id uuid;
begin
  select count(*) into recent from public.site_suggestions where sender_hash = p_sender_hash and created_at > now() - interval '1 hour';
  if recent >= p_max_per_hour then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  insert into public.site_suggestions (name, area, message, sender_hash)
  values (p_name, p_area, p_message, p_sender_hash)
  returning id into suggestion_id;
  return jsonb_build_object('status', 'saved', 'id', suggestion_id);
end;
$$;
revoke execute on function public.insert_site_suggestion(text, text, text, text, int) from public, anon, authenticated;
grant execute on function public.insert_site_suggestion(text, text, text, text, int) to service_role;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;

-- New suggestions show up in the admin at once where Realtime is on.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.site_suggestions;
  end if;
end;
$$;
