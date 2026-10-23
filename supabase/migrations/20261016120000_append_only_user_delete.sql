-- The append-only tables (history, audit log, credit transactions) refer to the user who made each row, with
-- "on delete set null". The append-only trigger used to stop that update too, so a user who had ever done anything in
-- the admin could not be deleted. The trigger now takes the name of that column and lets exactly one change through:
-- the column becoming null while everything else stays the same.

create or replace function private.forbid_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and tg_nargs = 1
     and to_jsonb(new) ->> tg_argv[0] is null
     and (to_jsonb(new) - tg_argv[0]) = (to_jsonb(old) - tg_argv[0]) then
    return new;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

drop trigger content_revisions_append_only on public.content_revisions;
create trigger content_revisions_append_only
  before update or delete on public.content_revisions
  for each row execute function private.forbid_change('created_by');

drop trigger credit_transactions_append_only on public.credit_transactions;
create trigger credit_transactions_append_only
  before update or delete on public.credit_transactions
  for each row execute function private.forbid_change('created_by');

drop trigger audit_log_append_only on public.audit_log;
create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function private.forbid_change('actor');
