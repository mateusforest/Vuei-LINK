-- Expiring traveler trip-link packages.
--
-- Purchases are tracked as independent credit lots. Consumption uses FEFO
-- (first expiry, first out), while balances that existed before this migration
-- are preserved in a non-expiring legacy lot. Agency billing and AI credits are
-- deliberately outside this migration.

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check check (
    transaction_type in (
      'starter_grant',
      'purchase',
      'consume',
      'refund',
      'adjustment',
      'migration_grant',
      'expiration'
    )
  );

create table if not exists public.wallet_credit_lots (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  asset_type text not null,
  source_transaction_id uuid null references public.wallet_transactions(id) on delete restrict,
  wallet_product_id uuid null references public.wallet_products(id) on delete set null,
  original_amount integer not null,
  remaining_amount integer not null,
  expires_at timestamptz null,
  expired_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_credit_lots_asset_type_check check (asset_type in ('trip_link')),
  constraint wallet_credit_lots_original_amount_check check (original_amount > 0),
  constraint wallet_credit_lots_remaining_amount_check check (
    remaining_amount >= 0 and remaining_amount <= original_amount
  ),
  constraint wallet_credit_lots_source_transaction_unique unique (source_transaction_id)
);

create index if not exists idx_wallet_credit_lots_fefo
  on public.wallet_credit_lots (wallet_id, asset_type, expires_at, created_at, id)
  where remaining_amount > 0;

create unique index if not exists idx_wallet_credit_lots_legacy_opening
  on public.wallet_credit_lots (wallet_id, asset_type)
  where source_transaction_id is null
    and metadata ->> 'kind' = 'legacy_balance_backfill';

create table if not exists public.wallet_credit_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.wallet_credit_lots(id) on delete restrict,
  transaction_id uuid not null references public.wallet_transactions(id) on delete restrict,
  amount integer not null,
  created_at timestamptz not null default now(),
  constraint wallet_credit_lot_allocations_amount_check check (amount > 0),
  constraint wallet_credit_lot_allocations_unique unique (lot_id, transaction_id)
);

create index if not exists idx_wallet_credit_lot_allocations_transaction
  on public.wallet_credit_lot_allocations (transaction_id);

drop trigger if exists set_wallet_credit_lots_updated_at on public.wallet_credit_lots;
create trigger set_wallet_credit_lots_updated_at
before update on public.wallet_credit_lots
for each row
execute function public.set_updated_at();

comment on table public.wallet_credit_lots is
  'Auditable trip_link credit batches. New traveler package purchases expire independently; legacy balances remain non-expiring.';

comment on table public.wallet_credit_lot_allocations is
  'Links consume/expiration ledger transactions to the exact credit lot used, preserving FEFO auditability.';

-- Preserve every pre-existing positive balance without attempting to infer an
-- expiry from historical transactions that were sold as non-expiring.
insert into public.wallet_credit_lots (
  wallet_id,
  asset_type,
  original_amount,
  remaining_amount,
  expires_at,
  metadata
)
select
  balance.wallet_id,
  balance.asset_type,
  balance.balance,
  balance.balance,
  null,
  jsonb_build_object(
    'kind', 'legacy_balance_backfill',
    'non_expiring', true,
    'balance_preserved_at', now()
  )
from public.wallet_balances balance
where balance.asset_type = 'trip_link'
  and balance.balance > 0
  and not exists (
    select 1
    from public.wallet_credit_lots lot
    where lot.wallet_id = balance.wallet_id
      and lot.asset_type = balance.asset_type
  )
on conflict do nothing;

insert into public.wallet_products (code, name, asset_type, quantity, active, metadata)
values
  (
    'trip_link_1',
    '1 viagem',
    'trip_link',
    1,
    true,
    jsonb_build_object(
      'billing_scope', 'traveler_trip_link',
      'non_expiring', false,
      'activation_validity_interval', '90 days',
      'activation_validity_label', '90 dias',
      'expected_unit_amount', 2490,
      'currency', 'brl',
      'stripe_price_env', 'STRIPE_PRICE_TRAVELER_TRIP_LINK_1'
    )
  ),
  (
    'trip_link_3',
    '3 viagens',
    'trip_link',
    3,
    true,
    jsonb_build_object(
      'billing_scope', 'traveler_trip_link',
      'non_expiring', false,
      'activation_validity_interval', '6 months',
      'activation_validity_label', '6 meses',
      'expected_unit_amount', 5990,
      'currency', 'brl',
      'stripe_price_env', 'STRIPE_PRICE_TRAVELER_TRIP_LINK_3'
    )
  ),
  (
    'trip_link_5',
    '5 viagens',
    'trip_link',
    5,
    true,
    jsonb_build_object(
      'billing_scope', 'traveler_trip_link',
      'non_expiring', false,
      'activation_validity_interval', '12 months',
      'activation_validity_label', '12 meses',
      'expected_unit_amount', 8990,
      'currency', 'brl',
      'stripe_price_env', 'STRIPE_PRICE_TRAVELER_TRIP_LINK_5'
    )
  )
on conflict (code) do update
set
  name = excluded.name,
  asset_type = excluded.asset_type,
  quantity = excluded.quantity,
  active = excluded.active,
  stripe_price_id = null,
  metadata = coalesce(public.wallet_products.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

update public.wallet_products
set
  active = false,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'retired', true,
    'retired_reason', 'commercial_offer_1_3_5'
  ),
  updated_at = now()
where code = 'trip_link_10';

create or replace function public.ensure_wallet_credit_lot_coverage(
  p_wallet_id uuid,
  p_asset_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  covered_balance integer;
  uncovered_balance integer;
begin
  select balance
  into current_balance
  from public.wallet_balances
  where wallet_id = p_wallet_id
    and asset_type = p_asset_type
  for update;

  if not found then
    return;
  end if;

  select coalesce(sum(remaining_amount), 0)::integer
  into covered_balance
  from public.wallet_credit_lots
  where wallet_id = p_wallet_id
    and asset_type = p_asset_type;

  if covered_balance > current_balance then
    raise exception 'wallet_credit_lot_balance_inconsistent';
  end if;

  uncovered_balance := current_balance - covered_balance;
  if uncovered_balance > 0 then
    insert into public.wallet_credit_lots (
      wallet_id,
      asset_type,
      original_amount,
      remaining_amount,
      expires_at,
      metadata
    )
    values (
      p_wallet_id,
      p_asset_type,
      uncovered_balance,
      uncovered_balance,
      null,
      jsonb_build_object(
        'kind', 'legacy_balance_reconciliation',
        'non_expiring', true
      )
    );
  end if;
end;
$$;

create or replace function public.expire_wallet_credit_lots(
  p_wallet_id uuid,
  p_asset_type text,
  p_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  balance_row public.wallet_balances%rowtype;
  lot_row public.wallet_credit_lots%rowtype;
  expiration_transaction public.wallet_transactions%rowtype;
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
  where wallet_id = p_wallet_id
    and asset_type = p_asset_type
  for update;

  perform public.ensure_wallet_credit_lot_coverage(p_wallet_id, p_asset_type);

  for lot_row in
    select *
    from public.wallet_credit_lots
    where wallet_id = p_wallet_id
      and asset_type = p_asset_type
      and remaining_amount > 0
      and expires_at is not null
      and expires_at <= p_at
    order by expires_at asc, created_at asc, id asc
    for update
  loop
    if lot_row.remaining_amount > balance_row.balance then
      raise exception 'wallet_credit_lot_balance_inconsistent';
    end if;

    next_balance := balance_row.balance - lot_row.remaining_amount;

    update public.wallet_balances
    set balance = next_balance, updated_at = now()
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
      idempotency_key,
      metadata,
      created_at
    )
    values (
      p_wallet_id,
      p_asset_type,
      'expiration',
      -lot_row.remaining_amount,
      next_balance,
      'Validade de crédito de viagem encerrada',
      'wallet_expiration',
      lot_row.wallet_product_id,
      format('trip-link-expiration:%s', lot_row.id::text),
      jsonb_build_object(
        'kind', 'trip_link_expiration',
        'lot_id', lot_row.id,
        'expired_at', p_at,
        'lot_expires_at', lot_row.expires_at
      ),
      p_at
    )
    returning * into expiration_transaction;

    insert into public.wallet_credit_lot_allocations (lot_id, transaction_id, amount)
    values (lot_row.id, expiration_transaction.id, lot_row.remaining_amount);

    update public.wallet_credit_lots
    set remaining_amount = 0, expired_at = p_at, updated_at = now()
    where id = lot_row.id;
  end loop;

  return balance_row.balance;
end;
$$;

create or replace function public.get_wallet_available_balance(
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
begin
  perform public.expire_wallet_credit_lots(p_wallet_id, p_asset_type, now());

  return query
  select
    wallet_balance.wallet_id,
    wallet_balance.id,
    wallet_balance.asset_type,
    wallet_balance.balance,
    wallet_balance.starter_grant_applied
  from public.wallet_balances wallet_balance
  where wallet_balance.wallet_id = p_wallet_id
    and wallet_balance.asset_type = p_asset_type;
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
  product_row public.wallet_products%rowtype;
  transaction_row public.wallet_transactions%rowtype;
  lot_expires_at timestamptz;
  validity_interval text;
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
    select * into transaction_row
    from public.wallet_transactions
    where idempotency_key = p_idempotency_key
    limit 1;
  end if;

  if transaction_row.id is null and p_stripe_checkout_session_id is not null then
    select * into transaction_row
    from public.wallet_transactions
    where stripe_checkout_session_id = p_stripe_checkout_session_id
    limit 1;
  end if;

  if transaction_row.id is not null then
    if transaction_row.wallet_id <> p_wallet_id
       or transaction_row.asset_type <> p_asset_type
       or transaction_row.transaction_type <> 'purchase'
       or transaction_row.amount <> p_quantity then
      raise exception 'wallet_purchase_idempotency_conflict';
    end if;

    perform public.expire_wallet_credit_lots(p_wallet_id, p_asset_type, now());
    select * into balance_row
    from public.wallet_balances
    where wallet_id = p_wallet_id and asset_type = p_asset_type;

    return query
    select transaction_row.id, balance_row.wallet_id, balance_row.id,
      balance_row.asset_type, balance_row.balance, balance_row.starter_grant_applied;
    return;
  end if;

  if p_wallet_product_id is null then
    raise exception 'wallet_purchase_product_required';
  end if;

  select * into product_row
  from public.wallet_products
  where id = p_wallet_product_id
  for update;

  if not found
     or not product_row.active
     or product_row.asset_type <> p_asset_type
     or product_row.quantity <> p_quantity then
    raise exception 'wallet_purchase_product_invalid';
  end if;

  validity_interval := nullif(product_row.metadata ->> 'activation_validity_interval', '');
  if validity_interval is null then
    raise exception 'wallet_purchase_validity_missing';
  end if;

  begin
    lot_expires_at := now() + validity_interval::interval;
  exception
    when invalid_parameter_value or invalid_datetime_format then
      raise exception 'wallet_purchase_validity_invalid';
  end;

  perform public.ensure_wallet_balance(p_wallet_id, p_asset_type);
  perform public.expire_wallet_credit_lots(p_wallet_id, p_asset_type, now());

  select * into balance_row
  from public.wallet_balances
  where wallet_id = p_wallet_id and asset_type = p_asset_type
  for update;

  next_balance := balance_row.balance + p_quantity;

  update public.wallet_balances
  set balance = next_balance, updated_at = now()
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
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'credit_expires_at', lot_expires_at,
      'activation_validity_interval', validity_interval,
      'non_expiring', false
    ),
    p_created_by
  )
  returning * into transaction_row;

  insert into public.wallet_credit_lots (
    wallet_id,
    asset_type,
    source_transaction_id,
    wallet_product_id,
    original_amount,
    remaining_amount,
    expires_at,
    metadata
  )
  values (
    p_wallet_id,
    p_asset_type,
    transaction_row.id,
    p_wallet_product_id,
    p_quantity,
    p_quantity,
    lot_expires_at,
    jsonb_build_object(
      'kind', 'traveler_trip_link_purchase',
      'product_code', product_row.code,
      'activation_validity_interval', validity_interval
    )
  );

  return query
  select transaction_row.id, balance_row.wallet_id, balance_row.id,
    balance_row.asset_type, balance_row.balance, balance_row.starter_grant_applied;
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
  lot_row public.wallet_credit_lots%rowtype;
  next_balance integer;
begin
  if p_asset_type not in ('trip_link') then
    raise exception 'wallet_asset_type_invalid';
  end if;

  if p_trip_id is null then
    raise exception 'wallet_trip_id_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_wallet_id::text, ''), 0));
  perform public.expire_wallet_credit_lots(p_wallet_id, p_asset_type, now());

  if p_idempotency_key is not null then
    select * into transaction_row
    from public.wallet_transactions
    where idempotency_key = p_idempotency_key
    limit 1;
  end if;

  if transaction_row.id is null then
    select * into transaction_row
    from public.wallet_transactions
    where trip_id = p_trip_id
      and asset_type = p_asset_type
      and transaction_type = 'consume'
    limit 1;
  end if;

  if transaction_row.id is not null then
    if transaction_row.wallet_id <> p_wallet_id
       or transaction_row.trip_id is distinct from p_trip_id
       or transaction_row.asset_type <> p_asset_type
       or transaction_row.transaction_type <> 'consume'
       or transaction_row.amount <> -1 then
      raise exception 'wallet_consume_idempotency_conflict';
    end if;

    select * into balance_row
    from public.wallet_balances
    where wallet_id = p_wallet_id and asset_type = p_asset_type;

    return query
    select transaction_row.id, balance_row.wallet_id, balance_row.id,
      balance_row.asset_type, balance_row.balance, balance_row.starter_grant_applied;
    return;
  end if;

  select * into balance_row
  from public.wallet_balances
  where wallet_id = p_wallet_id and asset_type = p_asset_type
  for update;

  if not found or balance_row.balance < 1 then
    raise exception 'trip_link_insufficient_balance';
  end if;

  select * into lot_row
  from public.wallet_credit_lots
  where wallet_id = p_wallet_id
    and asset_type = p_asset_type
    and remaining_amount > 0
    and (expires_at is null or expires_at > now())
  order by expires_at asc nulls last, created_at asc, id asc
  limit 1
  for update;

  if not found then
    raise exception 'trip_link_insufficient_balance';
  end if;

  next_balance := balance_row.balance - 1;

  update public.wallet_balances
  set balance = next_balance, updated_at = now()
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
    jsonb_build_object(
      'kind', 'trip_link_consume',
      'credit_lot_id', lot_row.id,
      'credit_expires_at', lot_row.expires_at,
      'allocation_strategy', 'fefo'
    ),
    p_created_by
  )
  returning * into transaction_row;

  update public.wallet_credit_lots
  set remaining_amount = remaining_amount - 1, updated_at = now()
  where id = lot_row.id;

  insert into public.wallet_credit_lot_allocations (lot_id, transaction_id, amount)
  values (lot_row.id, transaction_row.id, 1);

  return query
  select transaction_row.id, balance_row.wallet_id, balance_row.id,
    balance_row.asset_type, balance_row.balance, balance_row.starter_grant_applied;
end;
$$;

create or replace function public.activate_traveler_trip_with_wallet(
  p_trip_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  trip_row public.trips%rowtype;
  wallet_row public.wallets%rowtype;
  consumption_row record;
  activation_idempotency_key text;
  activation_timestamp timestamptz;
  activation_deadline timestamptz;
  current_balance integer := 0;
begin
  if acting_user_id is null then
    raise exception 'trip_activation_auth_required';
  end if;

  if p_trip_id is null then
    raise exception 'trip_activation_trip_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(acting_user_id::text, 0));

  select * into trip_row
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'trip_activation_not_found';
  end if;

  if trip_row.owner_type <> 'traveler' then
    raise exception 'trip_activation_owner_type_invalid';
  end if;

  if trip_row.owner_user_id is distinct from acting_user_id then
    raise exception 'trip_activation_forbidden';
  end if;

  if trip_row.status = 'cancelled' then
    raise exception 'trip_activation_status_invalid';
  end if;

  if trip_row.end_date is null then
    raise exception 'trip_activation_end_date_required';
  end if;

  activation_deadline := public.calculate_traveler_trip_link_access_until(trip_row.end_date);

  select * into wallet_row
  from public.wallets
  where owner_type = 'traveler'
    and owner_user_id = acting_user_id
  limit 1
  for update;

  if wallet_row.id is not null then
    select available.balance into current_balance
    from public.get_wallet_available_balance(wallet_row.id, 'trip_link') available;
  end if;

  if trip_row.link_activated_at is not null then
    if trip_row.visibility <> 'public'
       and trip_row.status <> 'cancelled'
       and trip_row.link_access_until is not null
       and now() <= trip_row.link_access_until then
      update public.trips
      set visibility = 'public', updated_at = now()
      where id = trip_row.id
      returning * into trip_row;
    end if;

    return jsonb_build_object(
      'status', 'already_activated',
      'trip_id', trip_row.id,
      'transaction_id', trip_row.link_activation_transaction_id,
      'link_activated_at', trip_row.link_activated_at,
      'link_access_until', trip_row.link_access_until,
      'balance', current_balance
    );
  end if;

  if activation_deadline < now() then
    raise exception 'trip_activation_period_ended';
  end if;

  if wallet_row.id is null then
    raise exception 'trip_link_insufficient_balance';
  end if;

  if wallet_row.status <> 'active' then
    raise exception 'trip_activation_wallet_inactive';
  end if;

  activation_idempotency_key := format('trip-activation:%s', trip_row.id::text);

  select * into consumption_row
  from public.consume_wallet_asset_for_trip(
    wallet_row.id,
    'trip_link',
    trip_row.id,
    acting_user_id,
    'Ativacao do Link da Viagem',
    'traveler_trip_activation',
    activation_idempotency_key
  );

  activation_timestamp := now();

  update public.trips
  set
    visibility = 'public',
    link_activated_at = activation_timestamp,
    link_access_until = activation_deadline,
    link_activation_transaction_id = consumption_row.transaction_id,
    updated_at = now()
  where id = trip_row.id
  returning * into trip_row;

  return jsonb_build_object(
    'status', 'activated',
    'trip_id', trip_row.id,
    'transaction_id', consumption_row.transaction_id,
    'link_activated_at', trip_row.link_activated_at,
    'link_access_until', trip_row.link_access_until,
    'balance', consumption_row.balance
  );
end;
$$;

revoke all on table public.wallet_credit_lots from public, anon, authenticated;
revoke all on table public.wallet_credit_lot_allocations from public, anon, authenticated;
grant select, insert, update, delete on table public.wallet_credit_lots to service_role;
grant select, insert, update, delete on table public.wallet_credit_lot_allocations to service_role;

revoke all on function public.ensure_wallet_credit_lot_coverage(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_wallet_credit_lots(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_wallet_available_balance(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_wallet_purchase(uuid, text, integer, uuid, text, text, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.consume_wallet_asset_for_trip(uuid, text, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.activate_traveler_trip_with_wallet(uuid) from public, anon, service_role;

grant execute on function public.ensure_wallet_credit_lot_coverage(uuid, text) to service_role;
grant execute on function public.expire_wallet_credit_lots(uuid, text, timestamptz) to service_role;
grant execute on function public.get_wallet_available_balance(uuid, text) to service_role;
grant execute on function public.grant_wallet_purchase(uuid, text, integer, uuid, text, text, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.consume_wallet_asset_for_trip(uuid, text, uuid, uuid, text, text, text) to service_role;
grant execute on function public.activate_traveler_trip_with_wallet(uuid) to authenticated;
