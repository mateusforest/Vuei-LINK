-- Traveler trip-link lifecycle.
--
-- A trip is now created/claimed as a private draft. A trip_link wallet asset is
-- consumed only when the authenticated traveler explicitly activates the link.
-- Agency trips deliberately keep their existing behavior.

alter table public.trips
  add column if not exists link_activated_at timestamptz,
  add column if not exists link_access_until timestamptz,
  add column if not exists link_activation_transaction_id uuid;

alter table public.trips
  drop constraint if exists trips_link_activation_transaction_fk;

alter table public.trips
  add constraint trips_link_activation_transaction_fk
  foreign key (link_activation_transaction_id)
  references public.wallet_transactions(id)
  on delete restrict;

create unique index if not exists idx_trips_link_activation_transaction
  on public.trips (link_activation_transaction_id)
  where link_activation_transaction_id is not null;

comment on column public.trips.link_activated_at is
  'When a traveler trip first consumed (or was grandfathered into) one trip_link asset. Null for an unactivated traveler draft and unused by agency lifecycle rules.';

comment on column public.trips.link_access_until is
  'Reserved public-link deadline for traveler trips. It remains null until the post-trip/grace-period stage is implemented.';

comment on column public.trips.link_activation_transaction_id is
  'Wallet consume transaction that activated the traveler trip. Null is allowed only for grandfathered legacy links.';

-- Preserve historical updated_at values while classifying legacy rows. Keeping
-- disable/backfill/enable in one block also makes manual execution safe.
do $migration$
declare
  updated_at_trigger_was_enabled boolean;
begin
  select exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.trips'::regclass
      and tgname = 'set_trips_updated_at'
      and not tgisinternal
      and tgenabled = 'O'
  )
  into updated_at_trigger_was_enabled;

  if updated_at_trigger_was_enabled then
    execute 'alter table public.trips disable trigger set_trips_updated_at';
  end if;

  begin
    -- Grandfather legacy traveler links without charging them again. Status
    -- alone is intentionally not used: the old flow consumed at creation even
    -- for `draft`, and older public links may predate the wallet entirely.
    with legacy_activation as (
      select
        trip.id as trip_id,
        consume_transaction.id as transaction_id,
        consume_transaction.created_at as transaction_created_at
      from public.trips trip
      left join lateral (
        select
          wallet_transaction.id,
          wallet_transaction.created_at
        from public.wallet_transactions wallet_transaction
        inner join public.wallets wallet
          on wallet.id = wallet_transaction.wallet_id
        where wallet_transaction.trip_id = trip.id
          and wallet_transaction.asset_type = 'trip_link'
          and wallet_transaction.transaction_type = 'consume'
          and wallet_transaction.amount = -1
          and wallet.owner_type = 'traveler'
          and wallet.owner_user_id = trip.owner_user_id
        order by wallet_transaction.created_at asc, wallet_transaction.id asc
        limit 1
      ) consume_transaction on true
      where trip.owner_type = 'traveler'
        and trip.owner_user_id is not null
        and (
          consume_transaction.id is not null
          or trip.visibility = 'public'
        )
    )
    update public.trips trip
    set
      link_activated_at = coalesce(
        trip.link_activated_at,
        legacy_activation.transaction_created_at,
        trip.created_at,
        now()
      ),
      link_activation_transaction_id = coalesce(
        trip.link_activation_transaction_id,
        legacy_activation.transaction_id
      )
    from legacy_activation
    where trip.id = legacy_activation.trip_id;

    -- Pending rows from the previous flow must wait for claim and activation.
    update public.trips
    set visibility = 'private'
    where owner_type = 'traveler'
      and owner_user_id is null
      and visibility = 'public';
  exception
    when others then
      if updated_at_trigger_was_enabled then
        execute 'alter table public.trips enable trigger set_trips_updated_at';
      end if;
      raise;
  end;

  if updated_at_trigger_was_enabled then
    execute 'alter table public.trips enable trigger set_trips_updated_at';
  end if;
end;
$migration$;

alter table public.trips
  drop constraint if exists trips_traveler_link_activation_shape_check;

alter table public.trips
  add constraint trips_traveler_link_activation_shape_check check (
    owner_type <> 'traveler'
    or (
      link_access_until is null
      and (
        (
          link_activated_at is null
          and link_activation_transaction_id is null
        )
        or link_activated_at is not null
      )
    )
  );

alter table public.trips
  drop constraint if exists trips_traveler_public_link_activation_check;

alter table public.trips
  add constraint trips_traveler_public_link_activation_check check (
    owner_type <> 'traveler'
    or visibility <> 'public'
    or (
      owner_user_id is not null
      and link_activated_at is not null
    )
  );

-- Creation and claim retries used to be inferred from wallet consume rows. Keep
-- those operations idempotent after decoupling draft creation from consumption.
create table if not exists public.traveler_trip_request_idempotency (
  operation text not null,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint traveler_trip_request_idempotency_operation_check
    check (operation in ('create', 'claim')),
  constraint traveler_trip_request_idempotency_pk
    primary key (operation, owner_user_id, idempotency_key)
);

create index if not exists idx_traveler_trip_request_idempotency_trip
  on public.traveler_trip_request_idempotency (trip_id);

alter table public.traveler_trip_request_idempotency enable row level security;

comment on table public.traveler_trip_request_idempotency is
  'Server-only retry registry for traveler draft creation and pending-trip claims; it does not represent wallet balance or activation.';

-- Preserve retries that were recorded by the previous consume-at-create flow.
insert into public.traveler_trip_request_idempotency (
  operation,
  owner_user_id,
  idempotency_key,
  trip_id,
  created_at
)
select
  case
    when wallet_transaction.source = 'pending_trip_claim' then 'claim'
    else 'create'
  end,
  wallet.owner_user_id,
  wallet_transaction.idempotency_key,
  wallet_transaction.trip_id,
  wallet_transaction.created_at
from public.wallet_transactions wallet_transaction
inner join public.wallets wallet
  on wallet.id = wallet_transaction.wallet_id
inner join public.trips trip
  on trip.id = wallet_transaction.trip_id
 and trip.owner_type = 'traveler'
 and trip.owner_user_id = wallet.owner_user_id
where wallet.owner_type = 'traveler'
  and wallet.owner_user_id is not null
  and wallet_transaction.transaction_type = 'consume'
  and wallet_transaction.asset_type = 'trip_link'
  and wallet_transaction.trip_id is not null
  and wallet_transaction.idempotency_key is not null
  and wallet_transaction.source in ('authenticated_trip_creation', 'pending_trip_claim')
on conflict (operation, owner_user_id, idempotency_key) do nothing;

create or replace function public.enforce_traveler_trip_link_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activation_transaction_is_valid boolean;
begin
  if tg_op = 'UPDATE' then
    if new.owner_type is distinct from old.owner_type then
      raise exception 'traveler_trip_owner_type_immutable';
    end if;
  end if;

  if new.owner_type <> 'traveler' then
    return new;
  end if;

  -- Keep old service-role callers safe during a rolling deployment: a traveler
  -- INSERT that still asks for public visibility is stored as a private draft.
  if tg_op = 'INSERT'
     and new.link_activated_at is null
     and new.link_activation_transaction_id is null then
    if new.link_access_until is not null then
      raise exception 'traveler_trip_link_access_until_not_available';
    end if;

    if new.visibility = 'public' then
      new.visibility := 'private';
    end if;
    new.status := 'draft';
    return new;
  end if;

  -- Activation audit data is immutable after it has been established. Legacy
  -- grandfathered rows may legitimately keep a null transaction reference.
  if tg_op = 'UPDATE' then
    if old.owner_type = 'traveler'
       and old.link_activated_at is not null then
      if new.owner_user_id is distinct from old.owner_user_id then
        raise exception 'traveler_trip_link_activation_owner_immutable';
      end if;

      if new.link_activated_at is distinct from old.link_activated_at
         or new.link_activation_transaction_id is distinct from old.link_activation_transaction_id then
        raise exception 'traveler_trip_link_activation_immutable';
      end if;

      if new.link_access_until is not null then
        raise exception 'traveler_trip_link_access_until_not_available';
      end if;

      return new;
    end if;
  end if;

  if new.link_activated_at is null then
    if new.link_activation_transaction_id is not null then
      raise exception 'traveler_trip_link_activation_incomplete';
    end if;

    if new.link_access_until is not null then
      raise exception 'traveler_trip_link_access_until_not_available';
    end if;

    if new.visibility = 'public' then
      raise exception 'traveler_trip_link_activation_required';
    end if;

    return new;
  end if;

  if new.link_activation_transaction_id is null then
    raise exception 'traveler_trip_link_activation_incomplete';
  end if;

  if new.link_access_until is not null then
    raise exception 'traveler_trip_link_access_until_not_available';
  end if;

  select exists (
    select 1
    from public.wallet_transactions wallet_transaction
    inner join public.wallets wallet
      on wallet.id = wallet_transaction.wallet_id
    where wallet_transaction.id = new.link_activation_transaction_id
      and wallet_transaction.trip_id = new.id
      and wallet_transaction.asset_type = 'trip_link'
      and wallet_transaction.transaction_type = 'consume'
      and wallet_transaction.amount = -1
      and wallet.owner_type = 'traveler'
      and wallet.owner_user_id = new.owner_user_id
  )
  into activation_transaction_is_valid;

  if not activation_transaction_is_valid then
    raise exception 'traveler_trip_link_activation_transaction_invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_traveler_trip_link_activation on public.trips;
create trigger enforce_traveler_trip_link_activation
before insert or update of
  owner_type,
  owner_user_id,
  visibility,
  link_activated_at,
  link_access_until,
  link_activation_transaction_id
on public.trips
for each row
execute function public.enforce_traveler_trip_link_activation();

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
  p_visibility text default 'private',
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

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 0));

  if p_idempotency_key is not null then
    select request.trip_id
    into existing_trip_id
    from public.traveler_trip_request_idempotency request
    inner join public.trips trip
      on trip.id = request.trip_id
     and trip.owner_type = 'traveler'
     and trip.owner_user_id = p_owner_user_id
    where request.operation = 'create'
      and request.owner_user_id = p_owner_user_id
      and request.idempotency_key = p_idempotency_key
    limit 1;

    if existing_trip_id is not null then
      select *
      into created_trip
      from public.trips
      where id = existing_trip_id
        and owner_type = 'traveler'
        and owner_user_id = p_owner_user_id
      limit 1;

      if found then
        return created_trip;
      end if;
    end if;
  end if;

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
    claim_token_claimed_at,
    link_activated_at,
    link_access_until,
    link_activation_transaction_id
  )
  values (
    p_title,
    p_slug,
    p_destination,
    p_country,
    p_city,
    p_start_date,
    p_end_date,
    'draft',
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
    'private',
    p_travelers_count,
    coalesce(p_permissions, '{}'::jsonb),
    coalesce(p_credits_summary, '{}'::jsonb),
    coalesce(p_offline_enabled, false),
    coalesce(p_source, 'manual'),
    null,
    null,
    null,
    null,
    null,
    null
  )
  returning *
  into created_trip;

  if p_idempotency_key is not null then
    insert into public.traveler_trip_request_idempotency (
      operation,
      owner_user_id,
      idempotency_key,
      trip_id
    )
    values (
      'create',
      p_owner_user_id,
      p_idempotency_key,
      created_trip.id
    );
  end if;

  return created_trip;
end;
$$;

create or replace function public.claim_pending_trip_with_wallet(
  p_claim_token_hash text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trip_row public.trips%rowtype;
  existing_trip_id uuid;
  claim_idempotency_key text;
begin
  if p_user_id is null then
    raise exception 'pending_claim_user_required';
  end if;

  if coalesce(trim(p_claim_token_hash), '') = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  claim_idempotency_key := format(
    'pending_claim:%s:%s',
    p_user_id::text,
    p_claim_token_hash
  );

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select request.trip_id
  into existing_trip_id
  from public.traveler_trip_request_idempotency request
  inner join public.trips trip
    on trip.id = request.trip_id
   and trip.owner_type = 'traveler'
   and trip.owner_user_id = p_user_id
  where request.operation = 'claim'
    and request.owner_user_id = p_user_id
    and request.idempotency_key = claim_idempotency_key
  limit 1;

  if existing_trip_id is not null then
    return jsonb_build_object(
      'status', 'claimed',
      'trip_id', existing_trip_id
    );
  end if;

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

  if trip_row.claim_token_expires_at is null
     or trip_row.claim_token_expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  update public.trips
  set
    owner_user_id = p_user_id,
    status = 'draft',
    visibility = 'private',
    claim_token_hash = null,
    claim_token_expires_at = null,
    claim_token_claimed_at = now(),
    link_activated_at = null,
    link_access_until = null,
    link_activation_transaction_id = null,
    updated_at = now()
  where id = trip_row.id
  returning * into trip_row;

  insert into public.traveler_trip_request_idempotency (
    operation,
    owner_user_id,
    idempotency_key,
    trip_id
  )
  values (
    'claim',
    p_user_id,
    claim_idempotency_key,
    trip_row.id
  );

  return jsonb_build_object(
    'status', 'claimed',
    'trip_id', trip_row.id
  );
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
  balance_row public.wallet_balances%rowtype;
  transaction_row public.wallet_transactions%rowtype;
  activation_idempotency_key text;
  activation_timestamp timestamptz;
  next_balance integer;
  current_balance integer;
begin
  if acting_user_id is null then
    raise exception 'trip_activation_auth_required';
  end if;

  if p_trip_id is null then
    raise exception 'trip_activation_trip_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(acting_user_id::text, 0));

  select *
  into trip_row
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

  select wallet_balance.balance
  into current_balance
  from public.wallets wallet
  inner join public.wallet_balances wallet_balance
    on wallet_balance.wallet_id = wallet.id
   and wallet_balance.asset_type = 'trip_link'
  where wallet.owner_type = 'traveler'
    and wallet.owner_user_id = acting_user_id
  limit 1;

  if trip_row.status = 'cancelled' then
    raise exception 'trip_activation_status_invalid';
  end if;

  if trip_row.link_activated_at is not null then
    if trip_row.visibility <> 'public' then
      update public.trips
      set
        visibility = 'public',
        updated_at = now()
      where id = trip_row.id
      returning * into trip_row;
    end if;

    return jsonb_build_object(
      'status', 'already_activated',
      'trip_id', trip_row.id,
      'transaction_id', trip_row.link_activation_transaction_id,
      'link_activated_at', trip_row.link_activated_at,
      'link_access_until', trip_row.link_access_until,
      'balance', coalesce(current_balance, 0)
    );
  end if;

  activation_idempotency_key := format('trip-activation:%s', trip_row.id::text);

  select *
  into wallet_row
  from public.wallets
  where owner_type = 'traveler'
    and owner_user_id = acting_user_id
  limit 1
  for update;

  if not found then
    raise exception 'trip_link_insufficient_balance';
  end if;

  if wallet_row.status <> 'active' then
    raise exception 'trip_activation_wallet_inactive';
  end if;

  -- Coordinate with purchase/refund/legacy wallet RPCs, which lock by wallet id.
  perform pg_advisory_xact_lock(hashtextextended(wallet_row.id::text, 0));

  select *
  into balance_row
  from public.wallet_balances
  where wallet_id = wallet_row.id
    and asset_type = 'trip_link'
  for update;

  if not found then
    raise exception 'trip_link_insufficient_balance';
  end if;

  -- A stable idempotency key protects retries. If it is already used, it must
  -- describe this exact activation and wallet.
  select *
  into transaction_row
  from public.wallet_transactions
  where idempotency_key = activation_idempotency_key
  limit 1;

  if transaction_row.id is not null
     and (
       transaction_row.wallet_id <> wallet_row.id
       or transaction_row.trip_id is distinct from trip_row.id
       or transaction_row.asset_type <> 'trip_link'
       or transaction_row.transaction_type <> 'consume'
       or transaction_row.amount <> -1
     ) then
    raise exception 'trip_activation_idempotency_conflict';
  end if;

  -- Reuse a consume made by the legacy create/claim flow instead of billing it
  -- twice, even if its old idempotency key was different.
  if transaction_row.id is null then
    select *
    into transaction_row
    from public.wallet_transactions
    where trip_id = trip_row.id
      and asset_type = 'trip_link'
      and transaction_type = 'consume'
    limit 1;

    if transaction_row.id is not null
       and (
         transaction_row.wallet_id <> wallet_row.id
         or transaction_row.amount <> -1
       ) then
      raise exception 'trip_activation_transaction_invalid';
    end if;
  end if;

  if transaction_row.id is null then
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
      wallet_row.id,
      'trip_link',
      'consume',
      -1,
      next_balance,
      'Ativacao do Link da Viagem',
      'traveler_trip_activation',
      trip_row.id,
      activation_idempotency_key,
      jsonb_build_object(
        'kind', 'trip_link_activation'
      ),
      acting_user_id
    )
    returning * into transaction_row;
  end if;

  activation_timestamp := now();

  update public.trips
  set
    visibility = 'public',
    link_activated_at = activation_timestamp,
    link_access_until = null,
    link_activation_transaction_id = transaction_row.id,
    updated_at = now()
  where id = trip_row.id
  returning * into trip_row;

  return jsonb_build_object(
    'status', 'activated',
    'trip_id', trip_row.id,
    'transaction_id', transaction_row.id,
    'link_activated_at', trip_row.link_activated_at,
    'link_access_until', trip_row.link_access_until,
    'balance', balance_row.balance
  );
end;
$$;

-- Wallet ownership, balances and ledger entries stay server-only. Products keep
-- their existing read contract; only direct mutation is removed from browsers.
-- The only client-callable debit path derives ownership from auth.uid().
revoke all on table public.wallets from public, anon, authenticated;
revoke all on table public.wallet_balances from public, anon, authenticated;
revoke insert, update, delete on table public.wallet_products from public, anon, authenticated;
revoke all on table public.wallet_transactions from public, anon, authenticated;
revoke all on table public.traveler_trip_request_idempotency from public, anon, authenticated;

grant select, insert, update, delete on table public.wallets to service_role;
grant select, insert, update, delete on table public.wallet_balances to service_role;
grant select, insert, update, delete on table public.wallet_products to service_role;
grant select, insert, update, delete on table public.wallet_transactions to service_role;
grant select, insert, update, delete on table public.traveler_trip_request_idempotency to service_role;

revoke all on function public.ensure_wallet(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.ensure_wallet_balance(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_wallet_starter_grant_if_needed(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.consume_wallet_asset_for_trip(uuid, text, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.grant_wallet_purchase(uuid, text, integer, uuid, text, text, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.refund_wallet_asset(uuid, text, integer, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_authenticated_traveler_trip_with_wallet(uuid, text, text, text, text, text, date, date, text, text, text, text, text, text, text, text, integer, jsonb, jsonb, boolean, text, text) from public, anon, authenticated;
revoke all on function public.claim_pending_trip_with_wallet(text, uuid) from public, anon, authenticated;
revoke all on function public.enforce_traveler_trip_link_activation() from public, anon, authenticated;
revoke all on function public.activate_traveler_trip_with_wallet(uuid) from public, anon, service_role;

do $migration$
begin
  if to_regprocedure('public.claim_pending_trip_with_limit(text,uuid,integer)') is not null then
    execute 'revoke all on function public.claim_pending_trip_with_limit(text, uuid, integer) from public, anon, authenticated, service_role';
  end if;
end;
$migration$;

grant execute on function public.ensure_wallet(text, uuid, uuid) to service_role;
grant execute on function public.ensure_wallet_balance(uuid, text) to service_role;
grant execute on function public.apply_wallet_starter_grant_if_needed(uuid, text, uuid) to service_role;
grant execute on function public.consume_wallet_asset_for_trip(uuid, text, uuid, uuid, text, text, text) to service_role;
grant execute on function public.grant_wallet_purchase(uuid, text, integer, uuid, text, text, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.refund_wallet_asset(uuid, text, integer, uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.create_authenticated_traveler_trip_with_wallet(uuid, text, text, text, text, text, date, date, text, text, text, text, text, text, text, text, integer, jsonb, jsonb, boolean, text, text) to service_role;
grant execute on function public.claim_pending_trip_with_wallet(text, uuid) to service_role;
grant execute on function public.activate_traveler_trip_with_wallet(uuid) to authenticated;
