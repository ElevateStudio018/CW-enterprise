-- AI changes, second part: publishing keeps a copy of the owner's unpublished changes that go out with an AI change,
-- and undoing an AI change publishes the version before it, gives those changes back as a draft and refunds the
-- credits. Both are called by the ai-assistant Edge Function only.

create or replace function public.publish_ai_change(p_message_id uuid, p_marker text, p_patches jsonb, p_cost int, p_summary text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  message record;
  patch jsonb;
  doc jsonb;
  result jsonb;
  new_balance int;
  published jsonb;
  pending_content jsonb;
  pending_theme jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('website_content'));
  select * into message from public.ai_messages where id = p_message_id for update;
  if not found or message.status <> 'preview' then
    return jsonb_build_object('status', 'not_previewable');
  end if;
  if private.draft_marker() is distinct from p_marker then
    return jsonb_build_object('status', 'changed');
  end if;

  -- What the owner had not published yet is published with the change (it is what the preview showed); a copy is
  -- kept so that undoing the AI change can hand it back as unpublished changes.
  select data into published from public.site_snapshot where id = 1;
  select coalesce(jsonb_agg(jsonb_build_object('path', to_jsonb(w.path), 'op', w.op, 'value', w.value) order by array_length(w.path, 1), w.path), '[]'::jsonb)
    into pending_content from public.website_content w;
  pending_theme := private.theme_from_tables(published -> 'theme');
  if pending_theme = published -> 'theme' then
    pending_theme := null;
  end if;

  doc := private.assemble_draft();
  for patch in select value from jsonb_array_elements(p_patches) loop
    if patch ->> 'op' = 'delete' then
      doc := doc #- array(select jsonb_array_elements_text(patch -> 'path'));
    else
      doc := private.jsonb_set_deep(doc, array(select jsonb_array_elements_text(patch -> 'path')), patch -> 'value');
    end if;
  end loop;

  begin
    new_balance := private.credit_change(-p_cost, 'spend', left('AI: ' || p_summary, 200), p_message_id::text, p_actor);
  exception when sqlstate 'P0002' then
    return jsonb_build_object('status', 'insufficient_credits');
  end;

  result := private.publish_document(doc, 'ai', p_summary, p_actor);
  update public.ai_messages
  set status = 'published',
      credit_cost = p_cost,
      revision_id = (result ->> 'revisionId')::bigint,
      change_set = coalesce(change_set, '{}'::jsonb) || jsonb_build_object('bundledDraft', jsonb_build_object('content', pending_content, 'theme', pending_theme))
  where id = p_message_id;
  return result || jsonb_build_object('balance', new_balance);
end;
$$;

-- Undoes a published AI change while it is still the latest version: the version before it is published again, the
-- owner's unpublished changes that went out with it come back as a draft, and the credits are refunded in full.
create or replace function public.rollback_ai_change(p_message_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  message record;
  latest bigint;
  previous record;
  result jsonb;
  new_balance int;
  bundled jsonb;
  pending jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('website_content'));
  select * into message from public.ai_messages where id = p_message_id for update;
  if not found or message.status <> 'published' or message.revision_id is null then
    return jsonb_build_object('status', 'not_published');
  end if;
  select max(id) into latest from public.content_revisions;
  if latest is distinct from message.revision_id then
    return jsonb_build_object('status', 'not_latest');
  end if;
  select * into previous from public.content_revisions where id < message.revision_id and source <> 'backup' order by id desc limit 1;
  if not found then
    return jsonb_build_object('status', 'no_previous');
  end if;

  result := private.publish_document(previous.snapshot, 'restore', left('Ångrad AI-ändring: ' || coalesce(message.change_set ->> 'summary', ''), 500), p_actor);

  bundled := message.change_set -> 'bundledDraft';
  if bundled is not null then
    for pending in select value from jsonb_array_elements(coalesce(bundled -> 'content', '[]'::jsonb)) loop
      insert into public.website_content (path, op, value, updated_at, updated_by, client_id)
      values (array(select jsonb_array_elements_text(pending -> 'path')), pending ->> 'op', nullif(pending -> 'value', 'null'::jsonb), clock_timestamp(), p_actor, 'rollback')
      on conflict (path) do nothing;
    end loop;
    if jsonb_typeof(bundled -> 'theme') = 'object' then
      perform private.set_theme_tables(bundled -> 'theme');
    end if;
  end if;

  if message.credit_cost > 0 then
    new_balance := private.credit_change(message.credit_cost, 'refund', 'Återbetalt: ångrad AI-ändring', p_message_id::text, p_actor);
  else
    select balance into new_balance from public.credit_balance where account_id = 'site';
  end if;
  update public.ai_messages set status = 'rolled_back' where id = p_message_id;
  perform private.audit('ai.rollback', p_message_id::text, null, jsonb_build_object('version', result -> 'version', 'refund', message.credit_cost), p_actor);
  return result || jsonb_build_object('status', 'rolled_back', 'balance', new_balance);
end;
$$;

revoke execute on function public.publish_ai_change(uuid, text, jsonb, int, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_ai_change(uuid, text, jsonb, int, text, uuid) to service_role;
revoke execute on function public.rollback_ai_change(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rollback_ai_change(uuid, uuid) to service_role;
