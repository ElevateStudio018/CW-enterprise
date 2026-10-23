-- Core schema for the admin panel: who may administer the site, the content and its history, images, quote requests,
-- AI conversations, credits, reset requests and the audit log. Row level security is on for every table; the admin
-- reaches most of it through security-definer functions that check the caller's role themselves.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- Who is an admin

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'none' check (role in ('admin', 'none')),
  full_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Addresses that become admins when their account is created (by invitation; public sign-up is switched off).
create table private.admin_allowlist (
  email text primary key check (email = lower(email))
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    lower(new.email),
    case when exists (select 1 from private.admin_allowlist a where a.email = lower(new.email)) then 'admin' else 'none' end,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

create policy "Admins read profiles" on public.profiles
  for select to authenticated using ((select public.is_admin()));
create policy "Admins update their own name" on public.profiles
  for update to authenticated using (id = (select auth.uid()) and (select public.is_admin()))
  with check (id = (select auth.uid()) and role = 'admin');

-- ---------------------------------------------------------------------------------------------------------------------
-- Content: the published snapshot, the unpublished changes on top of it, the theme drafts and the history

-- The one published document the public site is built from. Readable by anyone: it is what the site shows anyway.
create table public.site_snapshot (
  id smallint primary key default 1 check (id = 1),
  version bigint not null,
  data jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null
);
alter table public.site_snapshot enable row level security;
create policy "Anyone reads the published snapshot" on public.site_snapshot for select to anon, authenticated using (true);

-- Unpublished changes, one row per changed part of the document (its path). Cleared when published.
create table public.website_content (
  path text[] primary key,
  op text not null check (op in ('set', 'delete')),
  value jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users (id) on delete set null,
  -- The browser tab that wrote it, so a tab's own saves never count as someone else's.
  client_id text not null default ''
);
alter table public.website_content enable row level security;
create policy "Admins read unpublished changes" on public.website_content for select to authenticated using ((select public.is_admin()));

-- The draft theme: the site's colours (scope site) and the admin's own prime colour (scope admin), and the fonts.
create table public.website_colors (
  scope text not null check (scope in ('site', 'admin')),
  key text not null check (key ~ '^[a-zA-Z]{1,40}$'),
  value text not null check (value ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (scope, key)
);
alter table public.website_colors enable row level security;
create policy "Admins read colours" on public.website_colors for select to authenticated using ((select public.is_admin()));

create table public.website_fonts (
  role text primary key check (role in ('heading', 'body', 'button')),
  family text not null check (family ~ '^[A-Za-z0-9 ]{1,60}$'),
  category text not null check (category in ('sans-serif', 'serif', 'display', 'handwriting', 'monospace')),
  weights int[] not null default '{}',
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.website_fonts enable row level security;
create policy "Admins read fonts" on public.website_fonts for select to authenticated using ((select public.is_admin()));

-- Every published version, never changed or removed.
create table public.content_revisions (
  id bigint generated always as identity primary key,
  version bigint not null,
  snapshot jsonb not null,
  source text not null check (source in ('baseline', 'manual', 'ai', 'restore', 'reset', 'backup')),
  summary text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_revisions_version_idx on public.content_revisions (version);
alter table public.content_revisions enable row level security;
create policy "Admins read the history" on public.content_revisions for select to authenticated using ((select public.is_admin()));

create or replace function private.forbid_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

create trigger content_revisions_append_only
  before update or delete on public.content_revisions
  for each row execute function private.forbid_change();

-- ---------------------------------------------------------------------------------------------------------------------
-- Images

create table public.website_images (
  id uuid primary key default gen_random_uuid(),
  -- The folder in the site-images bucket that holds the image and its smaller copies.
  storage_path text not null unique,
  -- What the image was cropped for: hero (wide), card (square), photo (4:3), logo, favicon, free.
  usage_key text not null default 'free',
  file_name text not null default '',
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  focal_point jsonb not null default '{"x": 50, "y": 50}',
  width int not null check (width > 0),
  height int not null check (height > 0),
  -- [{width, path}] of every stored copy, the largest last.
  variants jsonb not null default '[]',
  byte_size int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.website_images enable row level security;
create policy "Admins read images" on public.website_images for select to authenticated using ((select public.is_admin()));
create policy "Admins add images" on public.website_images for insert to authenticated with check ((select public.is_admin()));
create policy "Admins edit images" on public.website_images for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove images" on public.website_images for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------------------------------
-- Quote requests (written only by the submit-quote function)

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 200),
  work_type text not null default '' check (char_length(work_type) <= 200),
  message text not null default '' check (char_length(message) <= 5000),
  status text not null default 'new' check (status in ('new', 'read')),
  -- A one-way hash of the sender's address, only to limit how often one sender can send.
  sender_hash text not null default '',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index quote_requests_created_idx on public.quote_requests (created_at desc);
create index quote_requests_sender_idx on public.quote_requests (sender_hash, created_at);
alter table public.quote_requests enable row level security;
create policy "Admins read quote requests" on public.quote_requests for select to authenticated using ((select public.is_admin()));
create policy "Admins mark and remove quote requests" on public.quote_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Only the status and the soft-delete mark may change; what was sent stays as it was sent.
create or replace function private.quote_requests_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.name, new.phone, new.email, new.work_type, new.message, new.created_at, new.sender_hash)
     is distinct from (old.name, old.phone, old.email, old.work_type, old.message, old.created_at, old.sender_hash) then
    raise exception 'A quote request''s content cannot be changed' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger quote_requests_guard before update on public.quote_requests for each row execute function private.quote_requests_guard();

-- ---------------------------------------------------------------------------------------------------------------------
-- Settings (key/value), e.g. the onboarding checklist, the credit packs and the deploy state

create table public.settings (
  key text primary key check (key ~ '^[a-z_]{1,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.settings enable row level security;
create policy "Admins read settings" on public.settings for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------------------------------
-- AI assistant

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Ny konversation' check (char_length(title) <= 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;
create policy "Admins read conversations" on public.ai_conversations for select to authenticated using ((select public.is_admin()));
create policy "Admins start conversations" on public.ai_conversations for insert to authenticated with check ((select public.is_admin()));
create policy "Admins rename conversations" on public.ai_conversations for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete conversations" on public.ai_conversations for delete to authenticated using ((select public.is_admin()));

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  attachments jsonb not null default '[]',
  -- The classified request and its price, shown before anything runs.
  plan jsonb,
  -- The proposed changes to the content.
  change_set jsonb,
  credit_cost int not null default 0 check (credit_cost >= 0),
  status text not null default 'done' check (status in (
    'done', 'estimated', 'generating', 'preview', 'published', 'discarded', 'cancelled', 'failed', 'rolled_back'
  )),
  revision_id bigint references public.content_revisions (id),
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_created_idx on public.ai_messages (created_at);
alter table public.ai_messages enable row level security;
create policy "Admins read messages" on public.ai_messages for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------------------------------
-- Credits (changed only by the functions in the credits migration, run by the Edge Functions)

create table public.credit_balance (
  account_id text primary key default 'site',
  balance int not null check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.credit_balance enable row level security;
create policy "Admins read the balance" on public.credit_balance for select to authenticated using ((select public.is_admin()));

create table public.credit_transactions (
  id bigint generated always as identity primary key,
  amount int not null,
  type text not null check (type in ('grant', 'spend', 'refund', 'topup', 'adjustment')),
  description text not null,
  reference_id text,
  balance_after int not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.credit_transactions enable row level security;
create policy "Admins read transactions" on public.credit_transactions for select to authenticated using ((select public.is_admin()));
create trigger credit_transactions_append_only
  before update or delete on public.credit_transactions
  for each row execute function private.forbid_change();

create table public.credit_orders (
  id uuid primary key default gen_random_uuid(),
  pack int not null,
  credits int not null check (credits > 0),
  price numeric(10, 2) not null check (price >= 0),
  currency text not null default 'SEK',
  status text not null check (status in ('completed', 'pending_approval', 'rejected')),
  invoiced boolean not null default false,
  ordered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.credit_orders enable row level security;
create policy "Admins read orders" on public.credit_orders for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------------------------------
-- "Rensa alla ändringar": requests that Elevate Studio approves or denies by e-mail

create table public.reset_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired', 'cancelled', 'failed')),
  requested_by uuid references auth.users (id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 1000),
  snapshot_version bigint not null,
  -- Hash of the one-time secret in the approve/deny links; the secret itself is never stored.
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);
alter table public.reset_requests enable row level security;
create policy "Admins read reset requests" on public.reset_requests for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------------------------------
-- Audit log and login attempts

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id) on delete set null,
  actor_label text not null default '',
  action text not null,
  entity text not null default '',
  before jsonb,
  after jsonb,
  ip text not null default '',
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
create policy "Admins read the audit log" on public.audit_log for select to authenticated using ((select public.is_admin()));
create trigger audit_log_append_only before update or delete on public.audit_log for each row execute function private.forbid_change();

create table private.login_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_email_idx on private.login_attempts (email_hash, created_at);
create index login_attempts_ip_idx on private.login_attempts (ip_hash, created_at);

create or replace function private.audit(p_action text, p_entity text, p_before jsonb, p_after jsonb, p_actor uuid default null, p_label text default '')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor, actor_label, action, entity, before, after)
  values (coalesce(p_actor, (select auth.uid())), p_label, p_action, p_entity, p_before, p_after);
$$;
