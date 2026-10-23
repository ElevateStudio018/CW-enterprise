-- "Rensa alla ändringar", carried out only after Elevate Studio approves the request by e-mail (the reset-decision
-- function checks the signed link, then calls this with the service role).
create or replace function public.reset_to_baseline(p_request_id uuid, p_decided_by text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request record;
  current_snapshot record;
  baseline jsonb;
  result jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('website_content'));
  select * into request from public.reset_requests where id = p_request_id for update;
  if not found or request.status <> 'pending' or request.expires_at < now() then
    return jsonb_build_object('status', 'not_pending');
  end if;

  -- First a copy of what is published now, so the reset itself can be undone from the history.
  select version, data into current_snapshot from public.site_snapshot where id = 1;
  insert into public.content_revisions (version, snapshot, source, summary)
  values (current_snapshot.version, current_snapshot.data, 'backup', 'Säkerhetskopia före rensning');

  select snapshot into baseline from public.content_revisions where source = 'baseline' order by id limit 1;
  if baseline is null then
    raise exception 'The original version is missing';
  end if;
  result := private.publish_document(baseline, 'reset', 'Alla ändringar rensade (godkänt av Elevate Studio)', request.requested_by);

  update public.reset_requests set status = 'approved', decided_at = now(), decided_by = p_decided_by where id = p_request_id;
  perform private.audit('reset.approved', p_request_id::text, jsonb_build_object('version', current_snapshot.version), result, request.requested_by, p_decided_by);
  return result;
end;
$$;
revoke execute on function public.reset_to_baseline(uuid, text) from public, anon, authenticated;
grant execute on function public.reset_to_baseline(uuid, text) to service_role;

-- Reset requests that run out are handled by the functions (which also tell the customer), not by the nightly purge.
create or replace function public.purge_expired()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.login_attempts where created_at < now() - interval '1 day';
  delete from public.quote_requests where deleted_at is not null and deleted_at < now() - interval '30 days';
$$;
