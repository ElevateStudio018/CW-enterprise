-- Credits, quote requests, AI messages and reset requests: everything here is called by the Edge Functions with the
-- service role (never by the browser directly), after they have checked who is asking.

create or replace function private.credit_change(p_amount int, p_type text, p_description text, p_reference text, p_actor uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_balance int;
begin
  insert into public.credit_balance (account_id, balance) values ('site', 0) on conflict (account_id) do nothing;
  update public.credit_balance set balance = balance + p_amount, updated_at = now()
  where account_id = 'site' and balance + p_amount >= 0
  returning balance into new_balance;
  if new_balance is null then
    raise exception 'insufficient_credits' using errcode = 'P0002';
  end if;
  insert into public.credit_transactions (amount, type, description, reference_id, balance_after, created_by)
  values (p_amount, p_type, p_description, p_reference, new_balance, p_actor);
  return new_balance;
end;
$$;

-- Applies an approved AI change and publishes it in one go: the change set's patches are laid over the draft, the
-- result becomes the new published version, the credits are charged and the message is marked published. The Edge
-- Function has validated the resulting document; p_marker makes sure the draft is still the one it validated.
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
begin
  perform pg_advisory_xact_lock(hashtext('website_content'));
  select * into message from public.ai_messages where id = p_message_id for update;
  if not found or message.status <> 'preview' then
    return jsonb_build_object('status', 'not_previewable');
  end if;
  if private.draft_marker() is distinct from p_marker then
    return jsonb_build_object('status', 'changed');
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
  update public.ai_messages set status = 'published', credit_cost = p_cost, revision_id = (result ->> 'revisionId')::bigint where id = p_message_id;
  return result || jsonb_build_object('balance', new_balance);
end;
$$;

create or replace function public.credits_topup(p_pack int, p_credits int, p_price numeric, p_actor uuid, p_max_per_day int default 3)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
  order_id uuid;
  new_balance int;
begin
  perform pg_advisory_xact_lock(hashtext('credit_orders'));
  select count(*) into recent from public.credit_orders where created_at > now() - interval '24 hours' and status <> 'rejected';
  if recent >= p_max_per_day then
    insert into public.credit_orders (pack, credits, price, status, ordered_by)
    values (p_pack, p_credits, p_price, 'pending_approval', p_actor) returning id into order_id;
    perform private.audit('credits.order', order_id::text, null, jsonb_build_object('credits', p_credits, 'status', 'pending_approval'), p_actor);
    return jsonb_build_object('status', 'pending_approval', 'orderId', order_id,
      'balance', (select balance from public.credit_balance where account_id = 'site'));
  end if;
  insert into public.credit_orders (pack, credits, price, status, ordered_by)
  values (p_pack, p_credits, p_price, 'completed', p_actor) returning id into order_id;
  new_balance := private.credit_change(p_credits, 'topup', p_credits || ' credits (läggs på årsfakturan)', order_id::text, p_actor);
  perform private.audit('credits.order', order_id::text, null, jsonb_build_object('credits', p_credits, 'status', 'completed'), p_actor);
  return jsonb_build_object('status', 'completed', 'orderId', order_id, 'balance', new_balance);
end;
$$;

-- Quote requests from the public form, with a limit per sender.
create or replace function public.insert_quote_request(p_name text, p_phone text, p_email text, p_work_type text, p_message text, p_sender_hash text, p_max_per_hour int default 5)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
  request_id uuid;
begin
  select count(*) into recent from public.quote_requests where sender_hash = p_sender_hash and created_at > now() - interval '1 hour';
  if recent >= p_max_per_hour then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  insert into public.quote_requests (name, phone, email, work_type, message, sender_hash)
  values (p_name, p_phone, p_email, p_work_type, p_message, p_sender_hash)
  returning id into request_id;
  return jsonb_build_object('status', 'saved', 'id', request_id);
end;
$$;

-- Login attempts: at most five failures per address, and per network address, in fifteen minutes.
create or replace function public.login_allowed(p_email_hash text, p_ip_hash text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from private.login_attempts where email_hash = p_email_hash and not success and created_at > now() - interval '15 minutes') < 5
     and (select count(*) from private.login_attempts where ip_hash = p_ip_hash and not success and created_at > now() - interval '15 minutes') < 20;
$$;

create or replace function public.record_login(p_email_hash text, p_ip_hash text, p_success boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.login_attempts (email_hash, ip_hash, success) values (p_email_hash, p_ip_hash, p_success);
$$;

-- Old login attempts and quote requests removed more than 30 days ago go for good.
create or replace function public.purge_expired()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.login_attempts where created_at < now() - interval '1 day';
  delete from public.quote_requests where deleted_at is not null and deleted_at < now() - interval '30 days';
  update public.reset_requests set status = 'expired', decided_at = now(), decided_by = 'expired'
  where status = 'pending' and expires_at < now();
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-expired', '17 3 * * *', 'select public.purge_expired()');
  end if;
end;
$$;

-- These are for the Edge Functions only.
revoke execute on function public.publish_ai_change(uuid, text, jsonb, int, text, uuid) from public, anon, authenticated;
revoke execute on function public.credits_topup(int, int, numeric, uuid, int) from public, anon, authenticated;
revoke execute on function public.insert_quote_request(text, text, text, text, text, text, int) from public, anon, authenticated;
revoke execute on function public.login_allowed(text, text) from public, anon, authenticated;
revoke execute on function public.record_login(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.purge_expired() from public, anon, authenticated;
grant execute on function public.publish_ai_change(uuid, text, jsonb, int, text, uuid) to service_role;
grant execute on function public.credits_topup(int, int, numeric, uuid, int) to service_role;
grant execute on function public.insert_quote_request(text, text, text, text, text, text, int) to service_role;
grant execute on function public.login_allowed(text, text) to service_role;
grant execute on function public.record_login(text, text, boolean) to service_role;
grant execute on function public.purge_expired() to service_role;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;

-- New quote requests and content changes reach open admin tabs as they happen.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.quote_requests, public.website_content, public.website_colors, public.website_fonts;
  end if;
end;
$$;
