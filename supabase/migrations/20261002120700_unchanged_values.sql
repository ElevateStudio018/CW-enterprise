-- Saving a value that equals the published one removes its draft row instead of keeping an identical copy, so the
-- count of unpublished changes is honest after undoing or retyping. Otherwise the same as in the content functions.
create or replace function public.save_content_patch(
  p_path text[],
  p_value jsonb,
  p_op text default 'set',
  p_known_at timestamptz default null,
  p_base_version bigint default null,
  p_client_id text default '',
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version bigint;
  before_value jsonb;
  newer_elsewhere boolean;
  governing record;
  saved_at timestamptz;
  published_then jsonb;
  published_now jsonb;
begin
  perform private.require_admin();
  if p_op not in ('set', 'delete') then
    raise exception 'Unknown operation %', p_op;
  end if;
  if not private.content_path_ok(p_path) then
    raise exception 'This part of the content cannot be changed here: %', array_to_string(p_path, '.');
  end if;
  if p_op = 'set' and (p_value is null or pg_column_size(p_value) > 262144) then
    raise exception 'The value is missing or too large';
  end if;

  -- One save at a time, so a save always sees the one before it.
  perform pg_advisory_xact_lock(hashtext('website_content'));

  select version into current_version from public.site_snapshot where id = 1;
  before_value := private.assemble_draft() #> p_path;

  if not p_force then
    -- Someone else (another tab or device) changed this part, a part above it or a part inside it since this tab
    -- last heard from the server.
    select exists (
      select 1 from public.website_content w
      where (w.path = p_path or w.path = p_path[1:array_length(w.path, 1)] or w.path[1:array_length(p_path, 1)] = p_path)
        and w.client_id is distinct from p_client_id
        and (p_known_at is null or w.updated_at > p_known_at)
    ) into newer_elsewhere;

    -- Or it was published from elsewhere with this part changed.
    if not newer_elsewhere and p_base_version is not null and p_base_version < current_version then
      select r.snapshot #> p_path into published_then from public.content_revisions r where r.version = p_base_version order by r.id desc limit 1;
      select s.data #> p_path into published_now from public.site_snapshot s where s.id = 1;
      newer_elsewhere := published_then is distinct from published_now;
    end if;

    if newer_elsewhere then
      return jsonb_build_object('status', 'conflict', 'serverValue', before_value, 'version', current_version);
    end if;
  end if;

  -- A part inside something that has been removed cannot be changed on its own.
  select w.op, w.path into governing from public.website_content w
  where w.path = p_path[1:array_length(w.path, 1)] and array_length(w.path, 1) < array_length(p_path, 1)
  order by array_length(w.path, 1) desc limit 1;
  if found and governing.op = 'delete' then
    return jsonb_build_object('status', 'conflict', 'serverValue', null, 'version', current_version);
  end if;

  -- The new value replaces everything inside it.
  delete from public.website_content w where array_length(w.path, 1) > array_length(p_path, 1) and w.path[1:array_length(p_path, 1)] = p_path;

  -- A value set back to what is published is no change at all: its draft row goes, so nothing waits to be published
  -- (typing a word and deleting it again, or undoing every step).
  if not exists (
    select 1 from public.website_content w
    where w.path = p_path[1:array_length(w.path, 1)] and array_length(w.path, 1) < array_length(p_path, 1)
  ) then
    select s.data #> p_path into published_now from public.site_snapshot s where s.id = 1;
    if (p_op = 'set' and published_now = p_value) or (p_op = 'delete' and published_now is null) then
      delete from public.website_content w where w.path = p_path;
      perform private.audit('content.save', array_to_string(p_path, '.'), before_value, case when p_op = 'set' then p_value end);
      return jsonb_build_object('status', 'saved', 'updatedAt', clock_timestamp(), 'version', current_version);
    end if;
  end if;

  insert into public.website_content as w (path, op, value, updated_at, updated_by, client_id)
  values (p_path, p_op, case when p_op = 'set' then p_value end, clock_timestamp(), (select auth.uid()), coalesce(p_client_id, ''))
  on conflict (path) do update
    set op = excluded.op, value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by, client_id = excluded.client_id
  returning w.updated_at into saved_at;

  perform private.audit('content.save', array_to_string(p_path, '.'), before_value, case when p_op = 'set' then p_value end);

  return jsonb_build_object('status', 'saved', 'updatedAt', saved_at, 'version', current_version);
end;
$$;
