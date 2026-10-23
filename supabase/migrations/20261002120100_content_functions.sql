-- Saving, assembling and publishing the content. (Deletes of whole tables say "where true": PostgREST sessions refuse
-- a delete without a where clause, even inside functions.)
--
-- The draft is the published snapshot with the unpublished changes (website_content) laid over it, shortest path
-- first, and the draft theme (website_colors, website_fonts) in place of the snapshot's. Saves are patches on one path
-- at a time; publishing turns the draft into a new snapshot version and history row and clears the changes.

-- Sets a value deep inside a document, creating the objects on the way when they are missing.
create or replace function private.jsonb_set_deep(target jsonb, path text[], new_value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  head text;
begin
  if coalesce(array_length(path, 1), 0) = 0 then
    return new_value;
  end if;
  if target is not null and jsonb_typeof(target) = 'array' then
    raise exception 'Cannot change part of a list (%), only the whole list', array_to_string(path, '.');
  end if;
  if target is null or jsonb_typeof(target) <> 'object' then
    target := '{}'::jsonb;
  end if;
  head := path[1];
  return jsonb_set(target, array[head], private.jsonb_set_deep(target -> head, path[2:], new_value), true);
end;
$$;

-- A path the content saves may write: known top-level parts (not the theme, which has its own tables), plain keys.
create or replace function private.content_path_ok(p_path text[])
returns boolean
language sql
immutable
as $$
  select coalesce(array_length(p_path, 1), 0) between 1 and 12
    and p_path[1] = any (array['settings', 'company', 'navigation', 'footer', 'form', 'ui', 'servicePage', 'notFound',
                               'services', 'uppdrag', 'certificates', 'pages'])
    and not exists (select 1 from unnest(p_path) part where part !~ '^[A-Za-z0-9_-]{1,64}$');
$$;

create or replace function private.theme_from_tables(p_fallback jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'colors', coalesce(
      (select (p_fallback -> 'colors') || jsonb_object_agg(c.key, c.value) from public.website_colors c where c.scope = 'site'),
      p_fallback -> 'colors'),
    'fonts', coalesce(
      (select (p_fallback -> 'fonts') || jsonb_object_agg(f.role, jsonb_build_object('family', f.family, 'category', f.category))
         from public.website_fonts f),
      p_fallback -> 'fonts'));
$$;

-- The draft document. Internal; the admin reaches it through content_draft().
create or replace function private.assemble_draft()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  doc jsonb;
  change record;
begin
  select s.data into doc from public.site_snapshot s where s.id = 1;
  if doc is null then
    raise exception 'There is no published snapshot yet';
  end if;
  for change in
    select w.path, w.op, w.value from public.website_content w order by array_length(w.path, 1), w.path
  loop
    if change.op = 'delete' then
      doc := doc #- change.path;
    else
      doc := private.jsonb_set_deep(doc, change.path, change.value);
    end if;
  end loop;
  return jsonb_set(doc, '{theme}', private.theme_from_tables(doc -> 'theme'));
end;
$$;

-- Fingerprint of everything the draft is made of, to tell whether it changed between two moments.
create or replace function private.draft_marker()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(
    coalesce((select version::text from public.site_snapshot where id = 1), '') || '|' ||
    coalesce((select string_agg(array_to_string(path, '.') || ':' || updated_at::text, ',' order by path) from public.website_content), '') || '|' ||
    coalesce((select string_agg(scope || key || value, ',' order by scope, key) from public.website_colors), '') || '|' ||
    coalesce((select string_agg(role || family || category, ',' order by role) from public.website_fonts), ''));
$$;

create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do this' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- What the admin opens the editor with: the draft, the published version it builds on, the fingerprint and the time
-- of the latest change (its starting point for telling its own saves from other devices').
create or replace function public.content_draft()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'draft', private.assemble_draft(),
    'version', (select version from public.site_snapshot where id = 1),
    'publishedAt', (select published_at from public.site_snapshot where id = 1),
    'marker', private.draft_marker(),
    'changes', (select count(*) from public.website_content),
    'themeChanged', (select private.theme_from_tables(s.data -> 'theme') is distinct from s.data -> 'theme' from public.site_snapshot s where s.id = 1),
    'knownAt', coalesce((select max(updated_at) from public.website_content), now()),
    'adminColors', coalesce((select jsonb_object_agg(key, value) from public.website_colors where scope = 'admin'), '{}'::jsonb));
end;
$$;

-- Saves one change. With p_force a conflict is overridden; otherwise a change someone else made to the same part
-- since p_known_at (from another device) is reported back instead of overwritten.
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

  insert into public.website_content as w (path, op, value, updated_at, updated_by, client_id)
  values (p_path, p_op, case when p_op = 'set' then p_value end, clock_timestamp(), (select auth.uid()), coalesce(p_client_id, ''))
  on conflict (path) do update
    set op = excluded.op, value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by, client_id = excluded.client_id
  returning w.updated_at into saved_at;

  perform private.audit('content.save', array_to_string(p_path, '.'), before_value, case when p_op = 'set' then p_value end);

  return jsonb_build_object('status', 'saved', 'updatedAt', saved_at, 'version', current_version);
end;
$$;

-- Saves several changes as one (a list reordered, an item added with its place in the order). All or nothing.
create or replace function public.save_content_patches(p_patches jsonb, p_known_at timestamptz default null, p_base_version bigint default null, p_client_id text default '', p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  patch jsonb;
  result jsonb;
  last_result jsonb;
begin
  perform private.require_admin();
  if jsonb_typeof(p_patches) <> 'array' or jsonb_array_length(p_patches) = 0 or jsonb_array_length(p_patches) > 50 then
    raise exception 'Expected 1–50 changes';
  end if;
  for patch in select value from jsonb_array_elements(p_patches) loop
    result := public.save_content_patch(
      array(select jsonb_array_elements_text(patch -> 'path')),
      patch -> 'value',
      coalesce(patch ->> 'op', 'set'),
      p_known_at, p_base_version, p_client_id, p_force);
    if result ->> 'status' = 'conflict' then
      -- Undo the ones already saved in this call.
      raise exception using errcode = 'P0001', message = 'conflict', detail = result::text;
    end if;
    last_result := result;
  end loop;
  return last_result;
exception
  when sqlstate 'P0001' then
    if sqlerrm = 'conflict' then
      return (select jsonb_build_object('status', 'conflict', 'serverValue', null));
    end if;
    raise;
end;
$$;

create or replace function public.save_theme_color(p_scope text, p_key text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_value text;
begin
  perform private.require_admin();
  select value into before_value from public.website_colors where scope = p_scope and key = p_key;
  insert into public.website_colors (scope, key, value, updated_at, updated_by)
  values (p_scope, p_key, upper(p_value), clock_timestamp(), (select auth.uid()))
  on conflict (scope, key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  perform private.audit('theme.color', p_scope || '.' || p_key, to_jsonb(before_value), to_jsonb(upper(p_value)));
  return jsonb_build_object('status', 'saved');
end;
$$;

create or replace function public.save_theme_font(p_role text, p_family text, p_category text, p_weights int[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_value jsonb;
begin
  perform private.require_admin();
  select to_jsonb(f) - 'updated_at' - 'updated_by' into before_value from public.website_fonts f where f.role = p_role;
  insert into public.website_fonts (role, family, category, weights, updated_at, updated_by)
  values (p_role, p_family, p_category, coalesce(p_weights, '{}'), clock_timestamp(), (select auth.uid()))
  on conflict (role) do update
    set family = excluded.family, category = excluded.category, weights = excluded.weights,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  perform private.audit('theme.font', p_role, before_value, jsonb_build_object('family', p_family, 'category', p_category));
  return jsonb_build_object('status', 'saved');
end;
$$;

-- Throws away every unpublished change, back to what is published.
create or replace function public.discard_draft()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  published jsonb;
begin
  perform private.require_admin();
  perform pg_advisory_xact_lock(hashtext('website_content'));
  select data into published from public.site_snapshot where id = 1;
  perform private.audit('content.discard', '', (select jsonb_agg(jsonb_build_object('path', path, 'op', op, 'value', value)) from public.website_content), null);
  delete from public.website_content where true;
  perform private.set_theme_tables(published -> 'theme');
  return jsonb_build_object('status', 'discarded');
end;
$$;

create or replace function private.set_theme_tables(p_theme jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.website_colors where scope = 'site';
  insert into public.website_colors (scope, key, value)
  select 'site', key, upper(value) from jsonb_each_text(p_theme -> 'colors');
  delete from public.website_fonts where true;
  insert into public.website_fonts (role, family, category)
  select key, value ->> 'family', value ->> 'category' from jsonb_each(p_theme -> 'fonts');
end;
$$;

-- Makes a document the published snapshot: a new version and history row, the unpublished changes cleared and the
-- theme tables set from it. Internal: used by publishing, restoring and resetting, which check who may do what.
create or replace function private.publish_document(p_doc jsonb, p_source text, p_summary text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version bigint;
  revision_id bigint;
begin
  select coalesce(max(version), 0) + 1 into next_version from public.site_snapshot;
  insert into public.site_snapshot (id, version, data, published_at, published_by)
  values (1, next_version, p_doc, now(), p_actor)
  on conflict (id) do update set version = excluded.version, data = excluded.data, published_at = excluded.published_at, published_by = excluded.published_by;
  insert into public.content_revisions (version, snapshot, source, summary, created_by)
  values (next_version, p_doc, p_source, left(coalesce(p_summary, ''), 500), p_actor)
  returning id into revision_id;
  delete from public.website_content where true;
  perform private.set_theme_tables(p_doc -> 'theme');
  perform private.audit('content.publish', 'version ' || next_version, null, jsonb_build_object('source', p_source, 'summary', p_summary), p_actor);
  return jsonb_build_object('status', 'published', 'version', next_version, 'revisionId', revision_id);
end;
$$;

-- Publishes the draft as it is, provided it is still what the caller checked (p_marker from content_draft()).
-- Called by the publish Edge Function after it has validated the draft against the content schema.
create or replace function public.publish_draft(p_marker text, p_summary text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform pg_advisory_xact_lock(hashtext('website_content'));
  if private.draft_marker() is distinct from p_marker then
    return jsonb_build_object('status', 'changed');
  end if;
  return private.publish_document(private.assemble_draft(), 'manual', p_summary, (select auth.uid()));
end;
$$;
revoke execute on function public.publish_draft(text, text) from public, anon;

-- Publishes an earlier version again, as a new version; the history keeps both.
create or replace function public.restore_revision(p_revision_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  revision record;
begin
  perform private.require_admin();
  perform pg_advisory_xact_lock(hashtext('website_content'));
  select * into revision from public.content_revisions where id = p_revision_id;
  if not found then
    raise exception 'No such version';
  end if;
  return private.publish_document(revision.snapshot, 'restore', 'Återställd version ' || revision.version, (select auth.uid()));
end;
$$;

-- The last 50 versions, without their documents.
create or replace function public.revision_list(p_limit int default 50)
returns table (id bigint, version bigint, source text, summary text, created_at timestamptz, created_by_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.version, r.source, r.summary, r.created_at, p.email
  from public.content_revisions r left join public.profiles p on p.id = r.created_by
  where public.is_admin()
  order by r.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Admin's own prime colour and other personal touches are plain settings saves.
create or replace function public.save_setting(p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_key not in ('onboarding', 'admin_preferences') then
    raise exception 'This setting cannot be changed here';
  end if;
  insert into public.settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), (select auth.uid()))
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return jsonb_build_object('status', 'saved');
end;
$$;

-- Internal functions are not part of the API.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;
