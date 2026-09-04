-- Unique migration version: wallet infrastructure follows the already-applied legacy RPC and precedes claim/lifecycle.
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

create unique index if not exists idx_wallets_traveler_owner
  on public.wallets (owner_user_id)
  where owner_type = 'traveler';

create unique index if not exists idx_wallets_agency_owner
  on public.wallets (agency_id)
  where owner_type = 'agency';

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

create unique index if not exists idx_wallet_products_stripe_price
  on public.wallet_products (stripe_price_id)
  where stripe_price_id is not null;

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

create index if not exists idx_wallet_transactions_wallet_asset_created
  on public.wallet_transactions (wallet_id, asset_type, created_at desc);

create index if not exists idx_wallet_transactions_trip_id
  on public.wallet_transactions (trip_id)
  where trip_id is not null;

create unique index if not exists idx_wallet_transactions_trip_consume_unique
  on public.wallet_transactions (trip_id, asset_type, transaction_type)
  where trip_id is not null and transaction_type = 'consume';

create unique index if not exists idx_wallet_transactions_checkout_session_unique
  on public.wallet_transactions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists idx_wallet_transactions_idempotency_unique
  on public.wallet_transactions (idempotency_key)
  where idempotency_key is not null;

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
