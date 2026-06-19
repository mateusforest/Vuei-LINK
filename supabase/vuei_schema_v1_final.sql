-- LEGADO / SNAPSHOT HISTORICO
-- Vuei schema v1 final
-- Consolidado antigo para revisao manual.
-- Nao tratar este arquivo como fonte unica de verdade do schema atual.
-- O runtime atual depende tambem dos SQLs versionados separados, como:
-- - ai_usage_logs.sql
-- - agency_billing.sql
-- - traveler_billing.sql
-- - trip_itineraries.sql
-- - trip_hotels.sql
-- Nao usar em bloco sem reconciliar com os SQLs modulares acima e com o schema real.
-- Principios:
-- - sem drop table
-- - sem truncate
-- - sem apagar dados
-- - sem policy aberta com true
-- - sem service role no frontend

create extension if not exists pgcrypto;

-- =========================================================
-- Helpers
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_master_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  );
$$;

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_members member
    where member.agency_id = target_agency_id
      and member.profile_id = auth.uid()
      and member.status = 'active'
  );
$$;

create or replace function public.is_agency_owner(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agencies agency
    where agency.id = target_agency_id
      and agency.owner_user_id = auth.uid()
  );
$$;

-- =========================================================
-- Core tables
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  avatar_url text,
  role text not null default 'traveler',
  agency_id uuid null,
  credits_balance integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text not null default 'traveler';
alter table public.profiles add column if not exists agency_id uuid null;
alter table public.profiles add column if not exists credits_balance integer not null default 0;
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  logo_url text,
  owner_user_id uuid references public.profiles(id) on delete set null,
  plan text not null default 'starter',
  status text not null default 'active',
  credits_balance integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agencies add column if not exists name text;
alter table public.agencies add column if not exists slug text;
alter table public.agencies add column if not exists logo_url text;
alter table public.agencies add column if not exists owner_user_id uuid;
alter table public.agencies add column if not exists plan text not null default 'starter';
alter table public.agencies add column if not exists status text not null default 'active';
alter table public.agencies add column if not exists credits_balance integer not null default 0;
alter table public.agencies add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.agencies add column if not exists branding jsonb not null default '{}'::jsonb;
alter table public.agencies add column if not exists created_at timestamptz not null default now();
alter table public.agencies add column if not exists updated_at timestamptz not null default now();

create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.agency_members add column if not exists agency_id uuid;
alter table public.agency_members add column if not exists profile_id uuid;
alter table public.agency_members add column if not exists role text not null default 'member';
alter table public.agency_members add column if not exists status text not null default 'active';
alter table public.agency_members add column if not exists created_at timestamptz not null default now();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  document text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients add column if not exists agency_id uuid;
alter table public.clients add column if not exists name text;
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists document text;
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists status text not null default 'active';
alter table public.clients add column if not exists created_at timestamptz not null default now();
alter table public.clients add column if not exists updated_at timestamptz not null default now();

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  destination text not null,
  country text,
  city text,
  start_date date,
  end_date date,
  status text not null default 'upcoming',
  style text,
  owner_type text not null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  admin_token text,
  public_token text,
  admin_link text,
  public_link text,
  cover_image text,
  visibility text not null default 'private',
  travelers_count integer not null default 1,
  permissions jsonb not null default '{}'::jsonb,
  credits_summary jsonb not null default '{}'::jsonb,
  offline_enabled boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trips add column if not exists title text;
alter table public.trips add column if not exists slug text;
alter table public.trips add column if not exists destination text;
alter table public.trips add column if not exists country text;
alter table public.trips add column if not exists city text;
alter table public.trips add column if not exists start_date date;
alter table public.trips add column if not exists end_date date;
alter table public.trips add column if not exists status text not null default 'upcoming';
alter table public.trips add column if not exists style text;
alter table public.trips add column if not exists owner_type text;
alter table public.trips add column if not exists owner_user_id uuid;
alter table public.trips add column if not exists agency_id uuid;
alter table public.trips add column if not exists client_id uuid;
alter table public.trips add column if not exists admin_token text;
alter table public.trips add column if not exists public_token text;
alter table public.trips add column if not exists admin_link text;
alter table public.trips add column if not exists public_link text;
alter table public.trips add column if not exists cover_image text;
alter table public.trips add column if not exists visibility text not null default 'private';
alter table public.trips add column if not exists travelers_count integer not null default 1;
alter table public.trips add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.trips add column if not exists credits_summary jsonb not null default '{}'::jsonb;
alter table public.trips add column if not exists offline_enabled boolean not null default false;
alter table public.trips add column if not exists source text not null default 'manual';
alter table public.trips add column if not exists created_at timestamptz not null default now();
alter table public.trips add column if not exists updated_at timestamptz not null default now();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  type text not null,
  file_url text,
  file_path text,
  mime_type text,
  size_bytes bigint,
  is_private boolean not null default true,
  visibility text not null default 'private',
  ai_extracted_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents add column if not exists trip_id uuid;
alter table public.documents add column if not exists client_id uuid;
alter table public.documents add column if not exists agency_id uuid;
alter table public.documents add column if not exists owner_user_id uuid;
alter table public.documents add column if not exists name text;
alter table public.documents add column if not exists type text;
alter table public.documents add column if not exists file_url text;
alter table public.documents add column if not exists file_path text;
alter table public.documents add column if not exists mime_type text;
alter table public.documents add column if not exists size_bytes bigint;
alter table public.documents add column if not exists is_private boolean not null default true;
alter table public.documents add column if not exists visibility text not null default 'private';
alter table public.documents add column if not exists ai_extracted_data jsonb not null default '{}'::jsonb;
alter table public.documents add column if not exists created_at timestamptz not null default now();
alter table public.documents add column if not exists updated_at timestamptz not null default now();

create table if not exists public.trip_hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text,
  hotel_name text,
  address text,
  check_in text,
  check_out text,
  confirmation_code text,
  confirmation_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_hotels add column if not exists trip_id uuid;
alter table public.trip_hotels add column if not exists name text;
alter table public.trip_hotels add column if not exists hotel_name text;
alter table public.trip_hotels add column if not exists address text;
alter table public.trip_hotels add column if not exists check_in text;
alter table public.trip_hotels add column if not exists check_out text;
alter table public.trip_hotels add column if not exists confirmation_code text;
alter table public.trip_hotels add column if not exists confirmation_number text;
alter table public.trip_hotels add column if not exists notes text;
alter table public.trip_hotels add column if not exists created_at timestamptz not null default now();
alter table public.trip_hotels add column if not exists updated_at timestamptz not null default now();

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid null references public.trips(id) on delete cascade,
  client_id uuid null references public.clients(id) on delete set null,
  agency_id uuid null references public.agencies(id) on delete set null,
  owner_user_id uuid null references public.profiles(id) on delete set null,
  source text not null,
  status text not null default 'open',
  title text null,
  last_message text null,
  last_message_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations add column if not exists trip_id uuid;
alter table public.ai_conversations add column if not exists client_id uuid;
alter table public.ai_conversations add column if not exists agency_id uuid;
alter table public.ai_conversations add column if not exists owner_user_id uuid;
alter table public.ai_conversations add column if not exists source text;
alter table public.ai_conversations add column if not exists status text not null default 'open';
alter table public.ai_conversations add column if not exists title text;
alter table public.ai_conversations add column if not exists last_message text;
alter table public.ai_conversations add column if not exists last_message_at timestamptz;
alter table public.ai_conversations add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_conversations add column if not exists created_at timestamptz not null default now();
alter table public.ai_conversations add column if not exists updated_at timestamptz not null default now();

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_messages add column if not exists conversation_id uuid;
alter table public.ai_messages add column if not exists role text;
alter table public.ai_messages add column if not exists content text;
alter table public.ai_messages add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_messages add column if not exists created_at timestamptz not null default now();

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  module text not null,
  action text not null,
  credits_used integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_logs add column if not exists trip_id uuid;
alter table public.ai_usage_logs add column if not exists user_id uuid;
alter table public.ai_usage_logs add column if not exists agency_id uuid;
alter table public.ai_usage_logs add column if not exists client_id uuid;
alter table public.ai_usage_logs add column if not exists module text;
alter table public.ai_usage_logs add column if not exists action text;
alter table public.ai_usage_logs add column if not exists credits_used integer not null default 0;
alter table public.ai_usage_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_usage_logs add column if not exists created_at timestamptz not null default now();

create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  module text not null,
  system_prompt text not null,
  user_prompt_template text,
  is_active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_prompts add column if not exists code text;
alter table public.ai_prompts add column if not exists name text;
alter table public.ai_prompts add column if not exists module text;
alter table public.ai_prompts add column if not exists system_prompt text;
alter table public.ai_prompts add column if not exists user_prompt_template text;
alter table public.ai_prompts add column if not exists is_active boolean not null default true;
alter table public.ai_prompts add column if not exists version integer not null default 1;
alter table public.ai_prompts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_prompts add column if not exists created_at timestamptz not null default now();
alter table public.ai_prompts add column if not exists updated_at timestamptz not null default now();

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_user_id uuid null references public.profiles(id) on delete set null,
  agency_id uuid null references public.agencies(id) on delete set null,
  type text not null,
  amount integer not null,
  balance_after integer null,
  reason text null,
  source text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null
);

alter table public.credit_transactions add column if not exists owner_type text;
alter table public.credit_transactions add column if not exists owner_user_id uuid;
alter table public.credit_transactions add column if not exists agency_id uuid;
alter table public.credit_transactions add column if not exists type text;
alter table public.credit_transactions add column if not exists amount integer;
alter table public.credit_transactions add column if not exists balance_after integer;
alter table public.credit_transactions add column if not exists reason text;
alter table public.credit_transactions add column if not exists source text;
alter table public.credit_transactions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.credit_transactions add column if not exists created_at timestamptz not null default now();
alter table public.credit_transactions add column if not exists created_by uuid;

-- =========================================================
-- FK adjustments and soft migrations
-- =========================================================

alter table public.profiles
  drop constraint if exists profiles_agency_id_fkey;

alter table public.profiles
  add constraint profiles_agency_id_fkey
  foreign key (agency_id) references public.agencies(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_conversations'
      and column_name = 'user_id'
  ) then
    execute '
      update public.ai_conversations
      set owner_user_id = coalesce(owner_user_id, user_id)
      where owner_user_id is null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_conversations'
      and column_name = 'channel'
  ) then
    execute '
      update public.ai_conversations
      set source = coalesce(source, channel)
      where source is null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trip_hotels'
      and column_name = 'hotel_name'
  ) then
    execute '
      update public.trip_hotels
      set name = coalesce(name, hotel_name)
      where coalesce(name, '''') = ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trip_hotels'
      and column_name = 'confirmation_number'
  ) then
    execute '
      update public.trip_hotels
      set confirmation_code = coalesce(confirmation_code, confirmation_number)
      where confirmation_code is null
    ';
  end if;
end $$;

-- =========================================================
-- Constraints
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('traveler', 'agency_owner', 'agency_member', 'master'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_credits_balance_check') then
    alter table public.profiles
      add constraint profiles_credits_balance_check
      check (credits_balance >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agencies_plan_check') then
    alter table public.agencies
      add constraint agencies_plan_check
      check (plan in ('starter', 'pro', 'enterprise'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agencies_status_check') then
    alter table public.agencies
      add constraint agencies_status_check
      check (status in ('pending', 'active', 'suspended', 'archived'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agencies_credits_balance_check') then
    alter table public.agencies
      add constraint agencies_credits_balance_check
      check (credits_balance >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agency_members_role_check') then
    alter table public.agency_members
      add constraint agency_members_role_check
      check (role in ('owner', 'admin', 'member', 'viewer'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agency_members_status_check') then
    alter table public.agency_members
      add constraint agency_members_status_check
      check (status in ('pending', 'active', 'inactive'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clients_status_check') then
    alter table public.clients
      add constraint clients_status_check
      check (status in ('lead', 'active', 'inactive', 'archived'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'trips_status_check') then
    alter table public.trips
      add constraint trips_status_check
      check (status in ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'trips_owner_type_check') then
    alter table public.trips
      add constraint trips_owner_type_check
      check (owner_type in ('traveler', 'agency'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'trips_visibility_check') then
    alter table public.trips
      add constraint trips_visibility_check
      check (visibility in ('private', 'public'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'trips_travelers_count_check') then
    alter table public.trips
      add constraint trips_travelers_count_check
      check (travelers_count >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'trips_owner_consistency_check') then
    alter table public.trips
      add constraint trips_owner_consistency_check
      check (
        (owner_type = 'traveler' and owner_user_id is not null)
        or
        (owner_type = 'agency' and agency_id is not null)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'documents_visibility_check') then
    alter table public.documents
      add constraint documents_visibility_check
      check (visibility in ('private', 'public_trip', 'agency_only'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'documents_size_bytes_check') then
    alter table public.documents
      add constraint documents_size_bytes_check
      check (size_bytes is null or size_bytes >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ai_conversations_source_check') then
    alter table public.ai_conversations
      add constraint ai_conversations_source_check
      check (source in ('concierge', 'itinerary', 'documents', 'ticket_reader'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ai_conversations_status_check') then
    alter table public.ai_conversations
      add constraint ai_conversations_status_check
      check (status in ('open', 'closed', 'archived'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ai_messages_role_check') then
    alter table public.ai_messages
      add constraint ai_messages_role_check
      check (role in ('user', 'assistant', 'agent', 'system'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ai_usage_logs_module_check') then
    alter table public.ai_usage_logs
      add constraint ai_usage_logs_module_check
      check (module in ('concierge', 'itinerary', 'documents', 'ticket_reader', 'accommodation_reader', 'flight_reader'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ai_usage_logs_credits_used_check') then
    alter table public.ai_usage_logs
      add constraint ai_usage_logs_credits_used_check
      check (credits_used >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ai_prompts_module_check') then
    alter table public.ai_prompts
      add constraint ai_prompts_module_check
      check (module in ('concierge', 'itinerary', 'documents', 'ticket_reader', 'accommodation_reader', 'flight_reader'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ai_prompts_version_check') then
    alter table public.ai_prompts
      add constraint ai_prompts_version_check
      check (version >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'credit_transactions_owner_type_check') then
    alter table public.credit_transactions
      add constraint credit_transactions_owner_type_check
      check (owner_type in ('traveler', 'agency'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'credit_transactions_type_check') then
    alter table public.credit_transactions
      add constraint credit_transactions_type_check
      check (type in ('grant', 'consume', 'refund', 'adjustment', 'purchase'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'credit_transactions_amount_non_zero') then
    alter table public.credit_transactions
      add constraint credit_transactions_amount_non_zero
      check (amount <> 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'credit_transactions_owner_target_check') then
    alter table public.credit_transactions
      add constraint credit_transactions_owner_target_check
      check (
        (owner_type = 'traveler' and owner_user_id is not null)
        or (owner_type = 'agency' and agency_id is not null)
      );
  end if;
end $$;

create unique index if not exists idx_profiles_id on public.profiles (id);
create unique index if not exists idx_agencies_slug on public.agencies (slug);
create unique index if not exists idx_ai_prompts_code on public.ai_prompts (code);
create unique index if not exists idx_agency_members_agency_profile_unique on public.agency_members (agency_id, profile_id);
create unique index if not exists idx_trips_slug on public.trips (slug);
create unique index if not exists idx_trips_admin_token on public.trips (admin_token) where admin_token is not null;
create unique index if not exists idx_trips_public_token on public.trips (public_token) where public_token is not null;

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_agency_id on public.profiles (agency_id);
create index if not exists idx_agencies_owner_user_id on public.agencies (owner_user_id);
create index if not exists idx_agency_members_agency_id on public.agency_members (agency_id);
create index if not exists idx_agency_members_profile_id on public.agency_members (profile_id);
create index if not exists idx_clients_agency_id on public.clients (agency_id);
create index if not exists idx_trips_owner_user_id on public.trips (owner_user_id);
create index if not exists idx_trips_agency_id on public.trips (agency_id);
create index if not exists idx_trips_client_id on public.trips (client_id);
create index if not exists idx_documents_trip_id on public.documents (trip_id);
create index if not exists idx_documents_client_id on public.documents (client_id);
create index if not exists idx_documents_agency_id on public.documents (agency_id);
create index if not exists idx_documents_owner_user_id on public.documents (owner_user_id);
create index if not exists idx_documents_visibility on public.documents (visibility);
create index if not exists idx_documents_is_private on public.documents (is_private);
create index if not exists idx_trip_hotels_trip_id on public.trip_hotels (trip_id);
create index if not exists idx_ai_conversations_trip_id on public.ai_conversations (trip_id);
create index if not exists idx_ai_conversations_client_id on public.ai_conversations (client_id);
create index if not exists idx_ai_conversations_agency_id on public.ai_conversations (agency_id);
create index if not exists idx_ai_conversations_owner_user_id on public.ai_conversations (owner_user_id);
create index if not exists idx_ai_conversations_created_at on public.ai_conversations (created_at desc);
create index if not exists idx_ai_conversations_last_message_at on public.ai_conversations (last_message_at desc nulls last);
create index if not exists idx_ai_messages_conversation_id on public.ai_messages (conversation_id);
create index if not exists idx_ai_messages_created_at on public.ai_messages (created_at desc);
create index if not exists idx_ai_usage_logs_trip_id on public.ai_usage_logs (trip_id);
create index if not exists idx_ai_usage_logs_user_id on public.ai_usage_logs (user_id);
create index if not exists idx_ai_usage_logs_agency_id on public.ai_usage_logs (agency_id);
create index if not exists idx_ai_usage_logs_module on public.ai_usage_logs (module);
create index if not exists idx_ai_prompts_module on public.ai_prompts (module);
create index if not exists idx_credit_transactions_owner_user_id on public.credit_transactions (owner_user_id);
create index if not exists idx_credit_transactions_agency_id on public.credit_transactions (agency_id);
create index if not exists idx_credit_transactions_created_at on public.credit_transactions (created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_agencies_updated_at on public.agencies;
create trigger set_agencies_updated_at
before update on public.agencies
for each row
execute function public.set_updated_at();

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row
execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

drop trigger if exists set_trip_hotels_updated_at on public.trip_hotels;
create trigger set_trip_hotels_updated_at
before update on public.trip_hotels
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_conversations_updated_at on public.ai_conversations;
create trigger set_ai_conversations_updated_at
before update on public.ai_conversations
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_prompts_updated_at on public.ai_prompts;
create trigger set_ai_prompts_updated_at
before update on public.ai_prompts
for each row
execute function public.set_updated_at();

create or replace function public.apply_credit_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if new.owner_type = 'traveler' then
    select credits_balance
      into current_balance
    from public.profiles
    where id = new.owner_user_id
    for update;

    if current_balance is null then
      raise exception 'Profile de creditos nao encontrado para owner_user_id=%', new.owner_user_id;
    end if;
  elsif new.owner_type = 'agency' then
    select credits_balance
      into current_balance
    from public.agencies
    where id = new.agency_id
    for update;

    if current_balance is null then
      raise exception 'Agencia de creditos nao encontrada para agency_id=%', new.agency_id;
    end if;
  else
    raise exception 'owner_type invalido: %', new.owner_type;
  end if;

  new.balance_after := coalesce(new.balance_after, current_balance + new.amount);

  if new.balance_after < 0 then
    raise exception 'Saldo de creditos insuficiente para esta operacao.';
  end if;

  if new.owner_type = 'traveler' then
    update public.profiles
    set credits_balance = new.balance_after,
        updated_at = now()
    where id = new.owner_user_id;
  else
    update public.agencies
    set credits_balance = new.balance_after,
        updated_at = now()
    where id = new.agency_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_credit_transaction_balance on public.credit_transactions;
create trigger apply_credit_transaction_balance
before insert on public.credit_transactions
for each row
execute function public.apply_credit_transaction_balance();

-- =========================================================
-- RLS
-- =========================================================

alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.clients enable row level security;
alter table public.trips enable row level security;
alter table public.documents enable row level security;
alter table public.trip_hotels enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_prompts enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "profiles_select_own_or_master" on public.profiles;
create policy "profiles_select_own_or_master"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_master_user()
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.is_master_user()
)
with check (
  id = auth.uid()
  or public.is_master_user()
);

drop policy if exists "agencies_select_own_or_master" on public.agencies;
create policy "agencies_select_own_or_master"
on public.agencies
for select
to authenticated
using (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or public.is_agency_member(id)
);

drop policy if exists "agencies_insert_owner" on public.agencies;
create policy "agencies_insert_owner"
on public.agencies
for insert
to authenticated
with check (
  public.is_master_user()
  or (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.role in ('agency_owner', 'master')
    )
  )
);

drop policy if exists "agencies_update_owner" on public.agencies;
create policy "agencies_update_owner"
on public.agencies
for update
to authenticated
using (
  public.is_master_user()
  or owner_user_id = auth.uid()
)
with check (
  public.is_master_user()
  or owner_user_id = auth.uid()
);

drop policy if exists "agency_members_select_same_agency_or_master" on public.agency_members;
create policy "agency_members_select_same_agency_or_master"
on public.agency_members
for select
to authenticated
using (
  public.is_master_user()
  or profile_id = auth.uid()
  or public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "agency_members_insert_owner_or_master" on public.agency_members;
create policy "agency_members_insert_owner_or_master"
on public.agency_members
for insert
to authenticated
with check (
  public.is_master_user()
  or public.is_agency_owner(agency_id)
);

drop policy if exists "agency_members_update_owner_or_master" on public.agency_members;
create policy "agency_members_update_owner_or_master"
on public.agency_members
for update
to authenticated
using (
  public.is_master_user()
  or public.is_agency_owner(agency_id)
)
with check (
  public.is_master_user()
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_select_same_agency_or_master" on public.clients;
create policy "clients_select_same_agency_or_master"
on public.clients
for select
to authenticated
using (
  public.is_master_user()
  or public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_insert_same_agency" on public.clients;
create policy "clients_insert_same_agency"
on public.clients
for insert
to authenticated
with check (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_update_same_agency" on public.clients;
create policy "clients_update_same_agency"
on public.clients
for update
to authenticated
using (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
)
with check (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_delete_same_agency" on public.clients;
create policy "clients_delete_same_agency"
on public.clients
for delete
to authenticated
using (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
  or public.is_master_user()
);

drop policy if exists "trips_select_owner_agency_or_master" on public.trips;
create policy "trips_select_owner_agency_or_master"
on public.trips
for select
to authenticated
using (
  public.is_master_user()
  or (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
  or visibility = 'public'
);

drop policy if exists "trips_select_public_visibility" on public.trips;
create policy "trips_select_public_visibility"
on public.trips
for select
to anon
using (
  visibility = 'public'
);

drop policy if exists "trips_insert_owner_or_agency" on public.trips;
create policy "trips_insert_owner_or_agency"
on public.trips
for insert
to authenticated
with check (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
  or public.is_master_user()
);

drop policy if exists "trips_update_owner_or_agency" on public.trips;
create policy "trips_update_owner_or_agency"
on public.trips
for update
to authenticated
using (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
  or public.is_master_user()
)
with check (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
  or public.is_master_user()
);

drop policy if exists "trips_delete_owner_or_agency" on public.trips;
create policy "trips_delete_owner_or_agency"
on public.trips
for delete
to authenticated
using (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
  or public.is_master_user()
);

drop policy if exists "documents_select_owner_agency_or_master" on public.documents;
create policy "documents_select_owner_agency_or_master"
on public.documents
for select
to authenticated
using (
  public.is_master_user()
  or (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
  or (
    visibility = 'public_trip'
    and is_private = false
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.visibility = 'public'
    )
  )
);

drop policy if exists "documents_select_public_trip" on public.documents;
create policy "documents_select_public_trip"
on public.documents
for select
to anon
using (
  visibility = 'public_trip'
  and is_private = false
  and exists (
    select 1
    from public.trips trip
    where trip.id = documents.trip_id
      and trip.visibility = 'public'
  )
);

drop policy if exists "documents_insert_owner_or_agency" on public.documents;
create policy "documents_insert_owner_or_agency"
on public.documents
for insert
to authenticated
with check (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.agency_id = documents.agency_id
        and (public.is_agency_member(documents.agency_id) or public.is_agency_owner(documents.agency_id))
    )
  )
  or public.is_master_user()
);

drop policy if exists "documents_update_owner_or_agency" on public.documents;
create policy "documents_update_owner_or_agency"
on public.documents
for update
to authenticated
using (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
  or public.is_master_user()
)
with check (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
  or public.is_master_user()
);

drop policy if exists "documents_delete_owner_or_agency" on public.documents;
create policy "documents_delete_owner_or_agency"
on public.documents
for delete
to authenticated
using (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
  or public.is_master_user()
);

drop policy if exists "trip_hotels_select_owner" on public.trip_hotels;
create policy "trip_hotels_select_owner"
on public.trip_hotels
for select
to authenticated
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
);

drop policy if exists "trip_hotels_insert_owner" on public.trip_hotels;
create policy "trip_hotels_insert_owner"
on public.trip_hotels
for insert
to authenticated
with check (
  exists (
    select 1 from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
  or public.is_master_user()
);

drop policy if exists "trip_hotels_update_owner" on public.trip_hotels;
create policy "trip_hotels_update_owner"
on public.trip_hotels
for update
to authenticated
using (
  exists (
    select 1 from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
  or public.is_master_user()
)
with check (
  exists (
    select 1 from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
  or public.is_master_user()
);

drop policy if exists "trip_hotels_delete_owner" on public.trip_hotels;
create policy "trip_hotels_delete_owner"
on public.trip_hotels
for delete
to authenticated
using (
  exists (
    select 1 from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
  or public.is_master_user()
);

drop policy if exists "ai_conversations_select_master" on public.ai_conversations;
create policy "ai_conversations_select_master"
on public.ai_conversations
for select
to authenticated
using (public.is_master_user());

drop policy if exists "ai_conversations_select_owner" on public.ai_conversations;
create policy "ai_conversations_select_owner"
on public.ai_conversations
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_conversations.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
);

drop policy if exists "ai_conversations_select_agency" on public.ai_conversations;
create policy "ai_conversations_select_agency"
on public.ai_conversations
for select
to authenticated
using (
  agency_id is not null
  and (
    public.is_agency_owner(agency_id)
    or public.is_agency_member(agency_id)
    or exists (
      select 1
      from public.trips trip
      where trip.id = ai_conversations.trip_id
        and trip.agency_id = ai_conversations.agency_id
        and (public.is_agency_owner(trip.agency_id) or public.is_agency_member(trip.agency_id))
    )
    or exists (
      select 1
      from public.clients client
      where client.id = ai_conversations.client_id
        and client.agency_id = ai_conversations.agency_id
        and (public.is_agency_owner(client.agency_id) or public.is_agency_member(client.agency_id))
    )
  )
);

drop policy if exists "ai_conversations_insert_owner" on public.ai_conversations;
create policy "ai_conversations_insert_owner"
on public.ai_conversations
for insert
to authenticated
with check (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
);

drop policy if exists "ai_conversations_update_owner_agency_master" on public.ai_conversations;
create policy "ai_conversations_update_owner_agency_master"
on public.ai_conversations
for update
to authenticated
using (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
)
with check (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
);

drop policy if exists "ai_messages_select_via_conversation" on public.ai_messages;
create policy "ai_messages_select_via_conversation"
on public.ai_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_conversations conversation
    where conversation.id = ai_messages.conversation_id
      and (
        public.is_master_user()
        or conversation.owner_user_id = auth.uid()
        or (
          conversation.agency_id is not null
          and (public.is_agency_owner(conversation.agency_id) or public.is_agency_member(conversation.agency_id))
        )
      )
  )
);

drop policy if exists "ai_messages_insert_via_conversation" on public.ai_messages;
create policy "ai_messages_insert_via_conversation"
on public.ai_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ai_conversations conversation
    where conversation.id = ai_messages.conversation_id
      and (
        public.is_master_user()
        or conversation.owner_user_id = auth.uid()
        or (
          conversation.agency_id is not null
          and (public.is_agency_owner(conversation.agency_id) or public.is_agency_member(conversation.agency_id))
        )
      )
  )
);

drop policy if exists "ai_usage_logs_select_owner_agency_or_master" on public.ai_usage_logs;
create policy "ai_usage_logs_select_owner_agency_or_master"
on public.ai_usage_logs
for select
to authenticated
using (
  public.is_master_user()
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_usage_logs.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_usage_logs_insert_owner_agency_or_master" on public.ai_usage_logs;
create policy "ai_usage_logs_insert_owner_agency_or_master"
on public.ai_usage_logs
for insert
to authenticated
with check (
  public.is_master_user()
  or (
    trip_id is not null
    and user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_usage_logs.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_prompts_select_active_or_master" on public.ai_prompts;
create policy "ai_prompts_select_active_or_master"
on public.ai_prompts
for select
to authenticated
using (
  is_active = true
  or public.is_master_user()
);

drop policy if exists "ai_prompts_insert_master" on public.ai_prompts;
create policy "ai_prompts_insert_master"
on public.ai_prompts
for insert
to authenticated
with check (public.is_master_user());

drop policy if exists "ai_prompts_update_master" on public.ai_prompts;
create policy "ai_prompts_update_master"
on public.ai_prompts
for update
to authenticated
using (public.is_master_user())
with check (public.is_master_user());

drop policy if exists "credit_transactions_select_master" on public.credit_transactions;
create policy "credit_transactions_select_master"
on public.credit_transactions
for select
to authenticated
using (public.is_master_user());

drop policy if exists "credit_transactions_select_traveler" on public.credit_transactions;
create policy "credit_transactions_select_traveler"
on public.credit_transactions
for select
to authenticated
using (
  owner_type = 'traveler'
  and owner_user_id = auth.uid()
);

drop policy if exists "credit_transactions_select_agency" on public.credit_transactions;
create policy "credit_transactions_select_agency"
on public.credit_transactions
for select
to authenticated
using (
  owner_type = 'agency'
  and agency_id is not null
  and (
    public.is_agency_owner(agency_id)
    or public.is_agency_member(agency_id)
  )
);

drop policy if exists "credit_transactions_insert_master" on public.credit_transactions;
create policy "credit_transactions_insert_master"
on public.credit_transactions
for insert
to authenticated
with check (
  public.is_master_user()
);

drop policy if exists "credit_transactions_insert_traveler_consume" on public.credit_transactions;
create policy "credit_transactions_insert_traveler_consume"
on public.credit_transactions
for insert
to authenticated
with check (
  owner_type = 'traveler'
  and owner_user_id = auth.uid()
  and type = 'consume'
  and amount < 0
);

drop policy if exists "credit_transactions_insert_agency_consume" on public.credit_transactions;
create policy "credit_transactions_insert_agency_consume"
on public.credit_transactions
for insert
to authenticated
with check (
  owner_type = 'agency'
  and agency_id is not null
  and type = 'consume'
  and amount < 0
  and (
    public.is_agency_owner(agency_id)
    or public.is_agency_member(agency_id)
  )
);

-- =========================================================
-- Storage buckets and storage policies
-- =========================================================

insert into storage.buckets (id, name, public)
values ('vuei-documents', 'vuei-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('vuei-avatars', 'vuei-avatars', true)
on conflict (id) do nothing;

drop policy if exists "documents bucket select own files" on storage.objects;
drop policy if exists "documents bucket upload own files" on storage.objects;
drop policy if exists "documents bucket update own files" on storage.objects;
drop policy if exists "documents bucket delete own files" on storage.objects;

create policy "documents bucket select own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "documents bucket upload own files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "documents bucket update own files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "documents bucket delete own files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "avatars_insert_own_folder" on storage.objects;
drop policy if exists "avatars_update_own_folder" on storage.objects;
drop policy if exists "avatars_delete_own_folder" on storage.objects;

create policy "avatars_select_public"
on storage.objects
for select
to public
using (bucket_id = 'vuei-avatars');

create policy "avatars_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vuei-avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "avatars_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vuei-avatars'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'vuei-avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "avatars_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vuei-avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);

comment on table public.trips is 'A leitura publica segura desta fase se limita a linhas com visibility = public. Escrita sem sessao continua fora do escopo do banco.';
comment on table public.documents is 'Documentos publicos do link usam visibility = public_trip e is_private = false. Upload e exclusao seguem escopo autenticado.';
comment on table public.ai_conversations is 'Nao ha policy anonima para concierge. Persistencia sem sessao exige backend/token seguro em fase posterior.';
