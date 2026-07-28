create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('traveler', 'agency_owner', 'agency_member', 'master')),
  constraint profiles_credits_balance_check check (credits_balance >= 0)
);

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
  updated_at timestamptz not null default now(),
  constraint agencies_plan_check check (plan in ('starter', 'pro', 'enterprise')),
  constraint agencies_status_check check (status in ('pending', 'active', 'suspended', 'archived')),
  constraint agencies_credits_balance_check check (credits_balance >= 0)
);

alter table public.profiles
  drop constraint if exists profiles_agency_id_fkey;

alter table public.profiles
  add constraint profiles_agency_id_fkey
  foreign key (agency_id) references public.agencies(id) on delete set null;

create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint agency_members_role_check check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint agency_members_status_check check (status in ('pending', 'active', 'inactive')),
  constraint agency_members_agency_profile_unique unique (agency_id, profile_id)
);

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
  updated_at timestamptz not null default now(),
  constraint clients_status_check check (status in ('lead', 'active', 'inactive', 'archived'))
);

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
  claim_token_hash text,
  claim_token_expires_at timestamptz,
  claim_token_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_status_check check (status in ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled')),
  constraint trips_owner_type_check check (owner_type in ('traveler', 'agency')),
  constraint trips_visibility_check check (visibility in ('private', 'public')),
  constraint trips_travelers_count_check check (travelers_count >= 1),
  constraint trips_owner_consistency_check check (
    (
      owner_type = 'traveler'
      and (
        (owner_user_id is not null and claim_token_hash is null)
        or
        (owner_user_id is null and claim_token_hash is not null and claim_token_expires_at is not null and claim_token_claimed_at is null)
      )
    )
    or
    (owner_type = 'agency' and agency_id is not null and client_id is not null)
  )
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_user_id uuid null references public.profiles(id) on delete cascade,
  agency_id uuid null references public.agencies(id) on delete cascade,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_owner_type_check check (owner_type in ('traveler', 'agency')),
  constraint wallets_status_check check (status in ('active', 'archived')),
  constraint wallets_owner_consistency_check check (
    (
      owner_type = 'traveler'
      and owner_user_id is not null
      and agency_id is null
    )
    or
    (
      owner_type = 'agency'
      and agency_id is not null
      and owner_user_id is null
    )
  )
);

create table if not exists public.wallet_balances (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  asset_type text not null,
  balance integer not null default 0,
  starter_grant_applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_balances_asset_type_check check (asset_type in ('trip_link')),
  constraint wallet_balances_balance_check check (balance >= 0),
  constraint wallet_balances_wallet_asset_unique unique (wallet_id, asset_type)
);

create table if not exists public.wallet_products (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  asset_type text not null,
  quantity integer not null,
  active boolean not null default true,
  stripe_price_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_products_asset_type_check check (asset_type in ('trip_link')),
  constraint wallet_products_quantity_check check (quantity > 0),
  constraint wallet_products_code_unique unique (code)
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  asset_type text not null,
  transaction_type text not null,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  source text not null,
  trip_id uuid null references public.trips(id) on delete set null,
  wallet_product_id uuid null references public.wallet_products(id) on delete set null,
  stripe_checkout_session_id text null,
  stripe_payment_intent_id text null,
  idempotency_key text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint wallet_transactions_asset_type_check check (asset_type in ('trip_link')),
  constraint wallet_transactions_type_check check (
    transaction_type in ('starter_grant', 'purchase', 'consume', 'refund', 'adjustment', 'migration_grant')
  ),
  constraint wallet_transactions_amount_non_zero_check check (amount <> 0),
  constraint wallet_transactions_balance_after_check check (balance_after >= 0)
);

create unique index if not exists idx_profiles_id on public.profiles (id);
create unique index if not exists idx_agencies_slug on public.agencies (slug);
create unique index if not exists idx_trips_slug on public.trips (slug);
create unique index if not exists idx_trips_admin_token on public.trips (admin_token) where admin_token is not null;
create unique index if not exists idx_trips_public_token on public.trips (public_token) where public_token is not null;
create unique index if not exists idx_trips_claim_token_hash on public.trips (claim_token_hash) where claim_token_hash is not null;
create unique index if not exists idx_wallets_traveler_owner on public.wallets (owner_user_id) where owner_type = 'traveler';
create unique index if not exists idx_wallets_agency_owner on public.wallets (agency_id) where owner_type = 'agency';
create unique index if not exists idx_wallet_products_stripe_price on public.wallet_products (stripe_price_id) where stripe_price_id is not null;
create unique index if not exists idx_wallet_transactions_trip_consume_unique on public.wallet_transactions (trip_id, asset_type, transaction_type) where trip_id is not null and transaction_type = 'consume';
create unique index if not exists idx_wallet_transactions_checkout_session_unique on public.wallet_transactions (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists idx_wallet_transactions_idempotency_unique on public.wallet_transactions (idempotency_key) where idempotency_key is not null;

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_trips_owner_user_id on public.trips (owner_user_id);
create index if not exists idx_trips_agency_id on public.trips (agency_id);
create index if not exists idx_trips_client_id on public.trips (client_id);
create index if not exists idx_clients_agency_id on public.clients (agency_id);
create index if not exists idx_agency_members_agency_id on public.agency_members (agency_id);
create index if not exists idx_agency_members_profile_id on public.agency_members (profile_id);
create index if not exists idx_wallet_transactions_wallet_asset_created on public.wallet_transactions (wallet_id, asset_type, created_at desc);
create index if not exists idx_wallet_transactions_trip_id on public.wallet_transactions (trip_id) where trip_id is not null;

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

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

drop trigger if exists set_wallet_balances_updated_at on public.wallet_balances;
create trigger set_wallet_balances_updated_at
before update on public.wallet_balances
for each row
execute function public.set_updated_at();

drop trigger if exists set_wallet_products_updated_at on public.wallet_products;
create trigger set_wallet_products_updated_at
before update on public.wallet_products
for each row
execute function public.set_updated_at();

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

create or replace function public.claim_pending_trip_with_limit(
  p_claim_token_hash text,
  p_user_id uuid,
  p_max_active_trips integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trip_row public.trips%rowtype;
  active_trip_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user_id::text, ''), 0));

  select *
  into trip_row
  from public.trips
  where claim_token_hash = p_claim_token_hash
    and owner_type = 'traveler'
    and owner_user_id is null
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if trip_row.claim_token_claimed_at is not null then
    return jsonb_build_object('status', 'already_claimed');
  end if;

  if trip_row.claim_token_expires_at is null or trip_row.claim_token_expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  if p_max_active_trips is not null then
    select count(*)
    into active_trip_count
    from public.trips
    where owner_user_id = p_user_id
      and owner_type = 'traveler'
      and status in ('draft', 'upcoming', 'ongoing');

    if active_trip_count >= p_max_active_trips then
      return jsonb_build_object('status', 'limit_exceeded');
    end if;
  end if;

  update public.trips
  set
    owner_user_id = p_user_id,
    claim_token_hash = null,
    claim_token_expires_at = null,
    claim_token_claimed_at = now(),
    updated_at = now()
  where id = trip_row.id
  returning * into trip_row;

  return jsonb_build_object(
    'status', 'claimed',
    'trip_id', trip_row.id
  );
end;
$$;

create or replace function public.ensure_wallet(
  p_owner_type text,
  p_owner_user_id uuid default null,
  p_agency_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_row public.wallets%rowtype;
begin
  if p_owner_type not in ('traveler', 'agency') then
    raise exception 'wallet_owner_type_invalid';
  end if;

  if p_owner_type = 'traveler' and (p_owner_user_id is null or p_agency_id is not null) then
    raise exception 'wallet_owner_invalid';
  end if;

  if p_owner_type = 'agency' and (p_agency_id is null or p_owner_user_id is not null) then
    raise exception 'wallet_owner_invalid';
  end if;

  if p_owner_type = 'traveler' then
    select *
    into wallet_row
    from public.wallets
    where owner_type = p_owner_type
      and owner_user_id = p_owner_user_id
    limit 1;

    if wallet_row.id is null then
      insert into public.wallets (owner_type, owner_user_id, agency_id, status, metadata)
      values (p_owner_type, p_owner_user_id, null, 'active', '{}'::jsonb)
      returning * into wallet_row;
    end if;
  else
    select *
    into wallet_row
    from public.wallets
    where owner_type = p_owner_type
      and agency_id = p_agency_id
    limit 1;

    if wallet_row.id is null then
      insert into public.wallets (owner_type, owner_user_id, agency_id, status, metadata)
      values (p_owner_type, null, p_agency_id, 'active', '{}'::jsonb)
      returning * into wallet_row;
    end if;
  end if;

  return wallet_row.id;
end;
$$;

create or replace function public.ensure_wallet_balance(
  p_wallet_id uuid,
  p_asset_type text
)
returns table (
  wallet_id uuid,
  balance_id uuid,
  asset_type text,
  balance integer,
  starter_grant_applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.wallet_balances%rowtype;
begin
  if p_asset_type not in ('trip_link') then
    raise exception 'wallet_asset_type_invalid';
  end if;

  select *
  into balance_row
  from public.wallet_balances
  where wallet_balances.wallet_id = p_wallet_id
    and wallet_balances.asset_type = p_asset_type
  limit 1;

  if balance_row.id is null then
    insert into public.wallet_balances (wallet_id, asset_type, balance, starter_grant_applied)
    values (p_wallet_id, p_asset_type, 0, false)
    returning * into balance_row;
  end if;

  return query
  select
    balance_row.wallet_id,
    balance_row.id,
    balance_row.asset_type,
    balance_row.balance,
    balance_row.starter_grant_applied;
end;
$$;

create or replace function public.apply_wallet_starter_grant_if_needed(
  p_wallet_id uuid,
  p_asset_type text,
  p_created_by uuid default null
)
returns table (
  wallet_id uuid,
  balance_id uuid,
  asset_type text,
  balance integer,
  starter_grant_applied boolean,
  applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.wallet_balances%rowtype;
  next_balance integer;
begin
  if p_asset_type not in ('trip_link') then
    raise exception 'wallet_asset_type_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_wallet_id::text, ''), 0));

  perform public.ensure_wallet_balance(p_wallet_id, p_asset_type);

  select *
  into balance_row
  from public.wallet_balances
  where wallet_balances.wallet_id = p_wallet_id
    and wallet_balances.asset_type = p_asset_type
  for update;

  if balance_row.starter_grant_applied then
    return query
    select
      balance_row.wallet_id,
      balance_row.id,
      balance_row.asset_type,
      balance_row.balance,
      balance_row.starter_grant_applied,
      false;
    return;
  end if;

  next_balance := balance_row.balance + 1;

  update public.wallet_balances
  set
    balance = next_balance,
    starter_grant_applied = true,
    updated_at = now()
  where id = balance_row.id
  returning * into balance_row;

  insert into public.wallet_transactions (
    wallet_id,
    asset_type,
    transaction_type,
    amount,
    balance_after,
    reason,
    source,
    metadata,
    created_by
  )
  values (
    p_wallet_id,
    p_asset_type,
    'starter_grant',
    1,
    next_balance,
    'Starter grant da wallet',
    'wallet_bootstrap',
    jsonb_build_object('kind', 'starter_grant'),
    p_created_by
  );

  return query
  select
    balance_row.wallet_id,
    balance_row.id,
    balance_row.asset_type,
    balance_row.balance,
    balance_row.starter_grant_applied,
    true;
end;
$$;

create or replace function public.consume_wallet_asset_for_trip(
  p_wallet_id uuid,
  p_asset_type text,
  p_trip_id uuid,
  p_created_by uuid default null,
  p_reason text default 'Consumo de saldo da wallet',
  p_source text default 'wallet_service',
  p_idempotency_key text default null
)
returns table (
  transaction_id uuid,
  wallet_id uuid,
  balance_id uuid,
  asset_type text,
  balance integer,
  starter_grant_applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.wallet_balances%rowtype;
  transaction_row public.wallet_transactions%rowtype;
  next_balance integer;
begin
  if p_asset_type not in ('trip_link') then
    raise exception 'wallet_asset_type_invalid';
  end if;

  if p_trip_id is null then
    raise exception 'wallet_trip_id_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_wallet_id::text, ''), 0));

  if p_idempotency_key is not null then
    select *
    into transaction_row
    from public.wallet_transactions
    where idempotency_key = p_idempotency_key
    limit 1;

    if transaction_row.id is not null then
      select *
      into balance_row
      from public.wallet_balances
      where wallet_balances.wallet_id = p_wallet_id
        and wallet_balances.asset_type = p_asset_type
      limit 1;

      return query
      select
        transaction_row.id,
        balance_row.wallet_id,
        balance_row.id,
        balance_row.asset_type,
        balance_row.balance,
        balance_row.starter_grant_applied;
      return;
    end if;
  end if;

  select *
  into transaction_row
  from public.wallet_transactions
  where trip_id = p_trip_id
    and asset_type = p_asset_type
    and transaction_type = 'consume'
  limit 1;

  if transaction_row.id is not null then
    select *
    into balance_row
    from public.wallet_balances
    where wallet_balances.wallet_id = p_wallet_id
      and wallet_balances.asset_type = p_asset_type
    limit 1;

    return query
    select
      transaction_row.id,
      balance_row.wallet_id,
      balance_row.id,
      balance_row.asset_type,
      balance_row.balance,
      balance_row.starter_grant_applied;
    return;
  end if;

  perform public.apply_wallet_starter_grant_if_needed(p_wallet_id, p_asset_type, p_created_by);

  select *
  into balance_row
  from public.wallet_balances
  where wallet_balances.wallet_id = p_wallet_id
    and wallet_balances.asset_type = p_asset_type
  for update;

  if balance_row.balance < 1 then
    raise exception 'trip_link_insufficient_balance';
  end if;

  next_balance := balance_row.balance - 1;

  update public.wallet_balances
  set
    balance = next_balance,
    updated_at = now()
  where id = balance_row.id
  returning * into balance_row;

  insert into public.wallet_transactions (
    wallet_id,
    asset_type,
    transaction_type,
    amount,
    balance_after,
    reason,
    source,
    trip_id,
    idempotency_key,
    metadata,
    created_by
  )
  values (
    p_wallet_id,
    p_asset_type,
    'consume',
    -1,
    next_balance,
    coalesce(p_reason, 'Consumo de saldo da wallet'),
    coalesce(p_source, 'wallet_service'),
    p_trip_id,
    p_idempotency_key,
    jsonb_build_object('kind', 'trip_link_consume'),
    p_created_by
  )
  returning * into transaction_row;

  return query
  select
    transaction_row.id,
    balance_row.wallet_id,
    balance_row.id,
    balance_row.asset_type,
    balance_row.balance,
    balance_row.starter_grant_applied;
end;
$$;

create or replace function public.grant_wallet_purchase(
  p_wallet_id uuid,
  p_asset_type text,
  p_quantity integer,
  p_wallet_product_id uuid default null,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_created_by uuid default null,
  p_reason text default 'Compra de saldo da wallet',
  p_source text default 'wallet_service',
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  wallet_id uuid,
  balance_id uuid,
  asset_type text,
  balance integer,
  starter_grant_applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.wallet_balances%rowtype;
  transaction_row public.wallet_transactions%rowtype;
  next_balance integer;
begin
  if p_asset_type not in ('trip_link') then
    raise exception 'wallet_asset_type_invalid';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'wallet_purchase_quantity_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_wallet_id::text, ''), 0));

  if p_idempotency_key is not null then
    select *
    into transaction_row
    from public.wallet_transactions
    where idempotency_key = p_idempotency_key
    limit 1;

    if transaction_row.id is not null then
      select *
      into balance_row
      from public.wallet_balances
      where wallet_balances.wallet_id = p_wallet_id
        and wallet_balances.asset_type = p_asset_type
      limit 1;

      return query
      select
        transaction_row.id,
        balance_row.wallet_id,
        balance_row.id,
        balance_row.asset_type,
        balance_row.balance,
        balance_row.starter_grant_applied;
      return;
    end if;
  end if;

  if p_stripe_checkout_session_id is not null then
    select *
    into transaction_row
    from public.wallet_transactions
    where stripe_checkout_session_id = p_stripe_checkout_session_id
    limit 1;

    if transaction_row.id is not null then
      select *
      into balance_row
      from public.wallet_balances
      where wallet_balances.wallet_id = p_wallet_id
        and wallet_balances.asset_type = p_asset_type
      limit 1;

      return query
      select
        transaction_row.id,
        balance_row.wallet_id,
        balance_row.id,
        balance_row.asset_type,
        balance_row.balance,
        balance_row.starter_grant_applied;
      return;
    end if;
  end if;

  perform public.ensure_wallet_balance(p_wallet_id, p_asset_type);

  select *
  into balance_row
  from public.wallet_balances
  where wallet_balances.wallet_id = p_wallet_id
    and wallet_balances.asset_type = p_asset_type
  for update;

  next_balance := balance_row.balance + p_quantity;

  update public.wallet_balances
  set
    balance = next_balance,
    updated_at = now()
  where id = balance_row.id
  returning * into balance_row;

  insert into public.wallet_transactions (
    wallet_id,
    asset_type,
    transaction_type,
    amount,
    balance_after,
    reason,
    source,
    wallet_product_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    idempotency_key,
    metadata,
    created_by
  )
  values (
    p_wallet_id,
    p_asset_type,
    'purchase',
    p_quantity,
    next_balance,
    coalesce(p_reason, 'Compra de saldo da wallet'),
    coalesce(p_source, 'wallet_service'),
    p_wallet_product_id,
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  returning * into transaction_row;

  return query
  select
    transaction_row.id,
    balance_row.wallet_id,
    balance_row.id,
    balance_row.asset_type,
    balance_row.balance,
    balance_row.starter_grant_applied;
end;
$$;

create or replace function public.refund_wallet_asset(
  p_wallet_id uuid,
  p_asset_type text,
  p_quantity integer,
  p_trip_id uuid default null,
  p_created_by uuid default null,
  p_reason text default 'Estorno de saldo da wallet',
  p_source text default 'wallet_service',
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  wallet_id uuid,
  balance_id uuid,
  asset_type text,
  balance integer,
  starter_grant_applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.wallet_balances%rowtype;
  transaction_row public.wallet_transactions%rowtype;
  next_balance integer;
begin
  if p_asset_type not in ('trip_link') then
    raise exception 'wallet_asset_type_invalid';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'wallet_refund_quantity_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_wallet_id::text, ''), 0));

  if p_idempotency_key is not null then
    select *
    into transaction_row
    from public.wallet_transactions
    where idempotency_key = p_idempotency_key
    limit 1;

    if transaction_row.id is not null then
      select *
      into balance_row
      from public.wallet_balances
      where wallet_balances.wallet_id = p_wallet_id
        and wallet_balances.asset_type = p_asset_type
      limit 1;

      return query
      select
        transaction_row.id,
        balance_row.wallet_id,
        balance_row.id,
        balance_row.asset_type,
        balance_row.balance,
        balance_row.starter_grant_applied;
      return;
    end if;
  end if;

  perform public.ensure_wallet_balance(p_wallet_id, p_asset_type);

  select *
  into balance_row
  from public.wallet_balances
  where wallet_balances.wallet_id = p_wallet_id
    and wallet_balances.asset_type = p_asset_type
  for update;

  next_balance := balance_row.balance + p_quantity;

  update public.wallet_balances
  set
    balance = next_balance,
    updated_at = now()
  where id = balance_row.id
  returning * into balance_row;

  insert into public.wallet_transactions (
    wallet_id,
    asset_type,
    transaction_type,
    amount,
    balance_after,
    reason,
    source,
    trip_id,
    idempotency_key,
    metadata,
    created_by
  )
  values (
    p_wallet_id,
    p_asset_type,
    'refund',
    p_quantity,
    next_balance,
    coalesce(p_reason, 'Estorno de saldo da wallet'),
    coalesce(p_source, 'wallet_service'),
    p_trip_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  returning * into transaction_row;

  return query
  select
    transaction_row.id,
    balance_row.wallet_id,
    balance_row.id,
    balance_row.asset_type,
    balance_row.balance,
    balance_row.starter_grant_applied;
end;
$$;

create or replace function public.create_authenticated_traveler_trip_with_wallet(
  p_owner_user_id uuid,
  p_title text,
  p_slug text,
  p_destination text,
  p_country text default null,
  p_city text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_status text default 'draft',
  p_style text default null,
  p_admin_token text default null,
  p_public_token text default null,
  p_admin_link text default null,
  p_public_link text default null,
  p_cover_image text default null,
  p_visibility text default 'public',
  p_travelers_count integer default 1,
  p_permissions jsonb default '{}'::jsonb,
  p_credits_summary jsonb default '{}'::jsonb,
  p_offline_enabled boolean default false,
  p_source text default 'manual',
  p_idempotency_key text default null
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_id uuid;
  created_trip public.trips%rowtype;
  existing_trip_id uuid;
begin
  if p_owner_user_id is null then
    raise exception 'wallet_trip_owner_required';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'wallet_trip_title_required';
  end if;

  if coalesce(trim(p_slug), '') = '' then
    raise exception 'wallet_trip_slug_required';
  end if;

  if coalesce(trim(p_destination), '') = '' then
    raise exception 'wallet_trip_destination_required';
  end if;

  if p_status not in ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled') then
    raise exception 'wallet_trip_status_invalid';
  end if;

  if p_visibility not in ('private', 'public') then
    raise exception 'wallet_trip_visibility_invalid';
  end if;

  if p_travelers_count is null or p_travelers_count < 1 then
    raise exception 'wallet_trip_travelers_count_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_owner_user_id::text, ''), 0));

  if p_idempotency_key is not null then
    select wt.trip_id
    into existing_trip_id
    from public.wallet_transactions wt
    inner join public.wallets w
      on w.id = wt.wallet_id
    where wt.idempotency_key = p_idempotency_key
      and wt.transaction_type = 'consume'
      and wt.asset_type = 'trip_link'
      and w.owner_type = 'traveler'
      and w.owner_user_id = p_owner_user_id
    limit 1;

    if existing_trip_id is not null then
      select *
      into created_trip
      from public.trips
      where id = existing_trip_id
      limit 1;

      return created_trip;
    end if;
  end if;

  wallet_id := public.ensure_wallet('traveler', p_owner_user_id, null);

  perform public.apply_wallet_starter_grant_if_needed(
    wallet_id,
    'trip_link',
    p_owner_user_id
  );

  insert into public.trips (
    title,
    slug,
    destination,
    country,
    city,
    start_date,
    end_date,
    status,
    style,
    owner_type,
    owner_user_id,
    agency_id,
    client_id,
    admin_token,
    public_token,
    admin_link,
    public_link,
    cover_image,
    visibility,
    travelers_count,
    permissions,
    credits_summary,
    offline_enabled,
    source,
    claim_token_hash,
    claim_token_expires_at,
    claim_token_claimed_at
  )
  values (
    p_title,
    p_slug,
    p_destination,
    p_country,
    p_city,
    p_start_date,
    p_end_date,
    p_status,
    p_style,
    'traveler',
    p_owner_user_id,
    null,
    null,
    p_admin_token,
    p_public_token,
    p_admin_link,
    p_public_link,
    p_cover_image,
    p_visibility,
    p_travelers_count,
    coalesce(p_permissions, '{}'::jsonb),
    coalesce(p_credits_summary, '{}'::jsonb),
    coalesce(p_offline_enabled, false),
    coalesce(p_source, 'manual'),
    null,
    null,
    null
  )
  returning *
  into created_trip;

  perform public.consume_wallet_asset_for_trip(
    wallet_id,
    'trip_link',
    created_trip.id,
    p_owner_user_id,
    'Consumo de Link da Viagem',
    'authenticated_trip_creation',
    p_idempotency_key
  );

  return created_trip;
end;
$$;

alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.clients enable row level security;
alter table public.trips enable row level security;

drop policy if exists "profiles_select_own_or_master" on public.profiles;
create policy "profiles_select_own_or_master"
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_master_user()
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "agencies_select_own_or_master" on public.agencies;
create policy "agencies_select_own_or_master"
on public.agencies
for select
using (
  public.is_master_user()
  or public.is_agency_member(id)
  or public.is_agency_owner(id)
);

drop policy if exists "agencies_update_owner" on public.agencies;
create policy "agencies_update_owner"
on public.agencies
for update
using (public.is_agency_owner(id))
with check (public.is_agency_owner(id));

drop policy if exists "agency_members_select_same_agency_or_master" on public.agency_members;
create policy "agency_members_select_same_agency_or_master"
on public.agency_members
for select
using (
  public.is_master_user()
  or profile_id = auth.uid()
  or public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_select_same_agency_or_master" on public.clients;
create policy "clients_select_same_agency_or_master"
on public.clients
for select
using (
  public.is_master_user()
  or public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_insert_same_agency" on public.clients;
create policy "clients_insert_same_agency"
on public.clients
for insert
with check (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_update_same_agency" on public.clients;
create policy "clients_update_same_agency"
on public.clients
for update
using (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
)
with check (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "trips_select_owner_agency_or_master" on public.trips;
create policy "trips_select_owner_agency_or_master"
on public.trips
for select
using (
  public.is_master_user()
  or (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
);

drop policy if exists "trips_insert_owner_or_agency" on public.trips;
create policy "trips_insert_owner_or_agency"
on public.trips
for insert
with check (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
);

drop policy if exists "trips_update_owner_or_agency" on public.trips;
create policy "trips_update_owner_or_agency"
on public.trips
for update
using (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
)
with check (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
);

comment on table public.trips is 'O acesso publico por token/link compartilhavel sera tratado em fase posterior com politicas e filtros dedicados.';
