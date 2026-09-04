-- Traveler public-link expiration. Version follows activation and product seeding.
--
-- Individual links remain public through the trip end date plus seven complete
-- calendar days. Agency trips deliberately keep their existing behavior.

create or replace function public.calculate_traveler_trip_link_access_until(
  p_end_date date
)
returns timestamptz
language sql
immutable
strict
set search_path = public
as $$
  select
    ((p_end_date + 8)::timestamp without time zone at time zone 'America/Sao_Paulo')
    - interval '1 microsecond';
$$;

comment on function public.calculate_traveler_trip_link_access_until(date) is
  'Returns the final instant of the seventh full calendar day after a traveler trip end date, using the Vuei business timezone.';

create or replace function public.is_trip_publicly_accessible(
  p_owner_type text,
  p_visibility text,
  p_status text,
  p_link_activated_at timestamptz,
  p_link_access_until timestamptz,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_visibility = 'public'
    and (
      p_owner_type = 'agency'
      or (
        p_owner_type = 'traveler'
        and p_status <> 'cancelled'
        and p_link_activated_at is not null
        and p_link_access_until is not null
        and p_at <= p_link_access_until
      )
    );
$$;

comment on function public.is_trip_publicly_accessible(text, text, text, timestamptz, timestamptz, timestamptz) is
  'Central fail-closed public-access rule. Traveler links expire; agency links retain their existing public behavior.';

create table if not exists public.traveler_trip_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  event_type text not null,
  previous_end_date date,
  new_end_date date,
  previous_access_until timestamptz,
  new_access_until timestamptz,
  actor_user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint traveler_trip_lifecycle_events_type_check check (
    event_type in (
      'legacy_access_backfill',
      'end_date_changed',
      'end_date_changed_after_end',
      'cancelled'
    )
  )
);

create index if not exists idx_traveler_trip_lifecycle_events_trip_created
  on public.traveler_trip_lifecycle_events (trip_id, created_at desc);

alter table public.traveler_trip_lifecycle_events enable row level security;

comment on table public.traveler_trip_lifecycle_events is
  'Server-only audit trail for traveler public-link deadline and cancellation changes.';

drop trigger if exists enforce_traveler_trip_link_activation on public.trips;

-- The previous stage reserved this field as null, so release those constraints
-- before the lifecycle backfill writes real deadlines.
alter table public.trips
  drop constraint if exists trips_traveler_link_activation_shape_check;

alter table public.trips
  drop constraint if exists trips_traveler_public_link_activation_check;

-- Grandfather already-active Individual links without charging another credit.
-- A legacy link whose canonical deadline is already past receives a one-time
-- seven-day rollout window, avoiding an abrupt cut-off when this migration lands.
do $migration$
declare
  trip_row record;
  canonical_deadline timestamptz;
  migrated_deadline timestamptz;
  rollout_deadline timestamptz := now() + interval '7 days';
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
    for trip_row in
      select id, end_date, updated_at
      from public.trips
      where owner_type = 'traveler'
        and link_activated_at is not null
        and link_access_until is null
      for update
    loop
      canonical_deadline := case
        when trip_row.end_date is null then null
        else public.calculate_traveler_trip_link_access_until(trip_row.end_date)
      end;
      migrated_deadline := greatest(
        coalesce(canonical_deadline, '-infinity'::timestamptz),
        rollout_deadline
      );

      update public.trips
      set
        link_access_until = migrated_deadline,
        updated_at = trip_row.updated_at
      where id = trip_row.id;

      insert into public.traveler_trip_lifecycle_events (
        trip_id,
        event_type,
        previous_end_date,
        new_end_date,
        previous_access_until,
        new_access_until,
        actor_user_id,
        metadata
      )
      values (
        trip_row.id,
        'legacy_access_backfill',
        trip_row.end_date,
        trip_row.end_date,
        null,
        migrated_deadline,
        null,
        jsonb_build_object(
          'canonical_deadline', canonical_deadline,
          'rollout_grace_applied', canonical_deadline is null or canonical_deadline < rollout_deadline
        )
      );
    end loop;
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
      (
        link_activated_at is null
        and link_activation_transaction_id is null
        and link_access_until is null
      )
      or (
        link_activated_at is not null
        and link_access_until is not null
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
      and link_access_until is not null
    )
  );

comment on column public.trips.link_access_until is
  'Inclusive public-link deadline for traveler trips: the trip end date plus seven complete calendar days. Unused by agency lifecycle rules.';

create or replace function public.enforce_traveler_trip_link_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activation_transaction_is_valid boolean;
  expected_access_until timestamptz;
begin
  if tg_op = 'UPDATE' and new.owner_type is distinct from old.owner_type then
    raise exception 'traveler_trip_owner_type_immutable';
  end if;

  if new.owner_type <> 'traveler' then
    return new;
  end if;

  if tg_op = 'INSERT'
     and new.link_activated_at is null
     and new.link_activation_transaction_id is null then
    if new.link_access_until is not null then
      raise exception 'traveler_trip_link_access_until_requires_activation';
    end if;

    if new.visibility = 'public' then
      new.visibility := 'private';
    end if;
    new.status := 'draft';
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.owner_type = 'traveler'
     and old.link_activated_at is not null then
    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'traveler_trip_link_activation_owner_immutable';
    end if;

    if new.link_activated_at is distinct from old.link_activated_at
       or new.link_activation_transaction_id is distinct from old.link_activation_transaction_id then
      raise exception 'traveler_trip_link_activation_immutable';
    end if;

    if new.end_date is distinct from old.end_date then
      if old.link_access_until is not null and now() > old.link_access_until then
        -- An ended link never resurrects merely because its end date changed.
        new.link_access_until := old.link_access_until;
      else
        if new.end_date is null then
          raise exception 'trip_activation_end_date_required';
        end if;
        new.link_access_until := public.calculate_traveler_trip_link_access_until(new.end_date);
      end if;
    elsif new.link_access_until is distinct from old.link_access_until then
      raise exception 'traveler_trip_link_access_until_immutable';
    end if;

    if new.status = 'cancelled' then
      new.visibility := 'private';
    end if;

    return new;
  end if;

  if new.link_activated_at is null then
    if new.link_activation_transaction_id is not null then
      raise exception 'traveler_trip_link_activation_incomplete';
    end if;

    if new.link_access_until is not null then
      raise exception 'traveler_trip_link_access_until_requires_activation';
    end if;

    if new.visibility = 'public' then
      raise exception 'traveler_trip_link_activation_required';
    end if;

    return new;
  end if;

  if new.link_activation_transaction_id is null then
    raise exception 'traveler_trip_link_activation_incomplete';
  end if;

  if new.end_date is null then
    raise exception 'trip_activation_end_date_required';
  end if;

  expected_access_until := public.calculate_traveler_trip_link_access_until(new.end_date);
  if new.link_access_until is distinct from expected_access_until then
    raise exception 'traveler_trip_link_access_until_invalid';
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

create trigger enforce_traveler_trip_link_activation
before insert or update of
  owner_type,
  owner_user_id,
  visibility,
  status,
  end_date,
  link_activated_at,
  link_access_until,
  link_activation_transaction_id
on public.trips
for each row
execute function public.enforce_traveler_trip_link_activation();

create or replace function public.audit_traveler_trip_lifecycle_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.owner_type <> 'traveler' or old.link_activated_at is null then
    return new;
  end if;

  if new.end_date is distinct from old.end_date then
    insert into public.traveler_trip_lifecycle_events (
      trip_id,
      event_type,
      previous_end_date,
      new_end_date,
      previous_access_until,
      new_access_until,
      metadata
    )
    values (
      new.id,
      case
        when old.link_access_until is not null and now() > old.link_access_until
          then 'end_date_changed_after_end'
        else 'end_date_changed'
      end,
      old.end_date,
      new.end_date,
      old.link_access_until,
      new.link_access_until,
      jsonb_build_object(
        'deadline_recalculated', new.link_access_until is distinct from old.link_access_until,
        'reactivation_prevented', old.link_access_until is not null
          and now() > old.link_access_until
          and new.link_access_until is not distinct from old.link_access_until
      )
    );
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.traveler_trip_lifecycle_events (
      trip_id,
      event_type,
      previous_end_date,
      new_end_date,
      previous_access_until,
      new_access_until,
      metadata
    )
    values (
      new.id,
      'cancelled',
      old.end_date,
      new.end_date,
      old.link_access_until,
      new.link_access_until,
      jsonb_build_object('credit_refunded', false)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_traveler_trip_lifecycle_change on public.trips;
create trigger audit_traveler_trip_lifecycle_change
after update of end_date, status on public.trips
for each row
execute function public.audit_traveler_trip_lifecycle_change();

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
  activation_deadline timestamptz;
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

  if trip_row.status = 'cancelled' then
    raise exception 'trip_activation_status_invalid';
  end if;

  if trip_row.end_date is null then
    raise exception 'trip_activation_end_date_required';
  end if;

  activation_deadline := public.calculate_traveler_trip_link_access_until(trip_row.end_date);

  select wallet_balance.balance
  into current_balance
  from public.wallets wallet
  inner join public.wallet_balances wallet_balance
    on wallet_balance.wallet_id = wallet.id
   and wallet_balance.asset_type = 'trip_link'
  where wallet.owner_type = 'traveler'
    and wallet.owner_user_id = acting_user_id
  limit 1;

  if trip_row.link_activated_at is not null then
    if trip_row.visibility <> 'public'
       and trip_row.status <> 'cancelled'
       and trip_row.link_access_until is not null
       and now() <= trip_row.link_access_until then
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

  if activation_deadline < now() then
    raise exception 'trip_activation_period_ended';
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
        'kind', 'trip_link_activation',
        'link_access_until', activation_deadline
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
    link_access_until = activation_deadline,
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

-- Close direct-Supabase bypasses as well as the application resolver. Owners,
-- agency members and master users retain their authenticated access branches.
drop policy if exists "trips_select_owner_agency_or_master" on public.trips;
create policy "trips_select_owner_agency_or_master"
on public.trips
for select
to authenticated
using (
  public.is_master_user()
  or (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
  or public.is_trip_publicly_accessible(
    owner_type,
    visibility,
    status,
    link_activated_at,
    link_access_until
  )
);

drop policy if exists "trips_select_public_visibility" on public.trips;
create policy "trips_select_public_visibility"
on public.trips
for select
to anon
using (
  public.is_trip_publicly_accessible(
    owner_type,
    visibility,
    status,
    link_activated_at,
    link_access_until
  )
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
        and public.is_trip_publicly_accessible(
          trip.owner_type,
          trip.visibility,
          trip.status,
          trip.link_activated_at,
          trip.link_access_until
        )
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
      and public.is_trip_publicly_accessible(
        trip.owner_type,
        trip.visibility,
        trip.status,
        trip.link_activated_at,
        trip.link_access_until
      )
  )
);

drop policy if exists "trip_flights_select_owner_agency_or_master" on public.trip_flights;
create policy "trip_flights_select_owner_agency_or_master"
on public.trip_flights
for select
to authenticated
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips trip
    where trip.id = trip_flights.trip_id
      and (
        trip.owner_user_id = auth.uid()
        or (
          trip.agency_id is not null
          and (public.is_agency_member(trip.agency_id) or public.is_agency_owner(trip.agency_id))
        )
        or public.is_trip_publicly_accessible(
          trip.owner_type,
          trip.visibility,
          trip.status,
          trip.link_activated_at,
          trip.link_access_until
        )
      )
  )
);

drop policy if exists "trip_flights_select_public_visibility" on public.trip_flights;
create policy "trip_flights_select_public_visibility"
on public.trip_flights
for select
to anon
using (
  exists (
    select 1
    from public.trips trip
    where trip.id = trip_flights.trip_id
      and public.is_trip_publicly_accessible(
        trip.owner_type,
        trip.visibility,
        trip.status,
        trip.link_activated_at,
        trip.link_access_until
      )
  )
);

drop policy if exists "trip_itineraries_select" on public.trip_itineraries;
create policy "trip_itineraries_select"
on public.trip_itineraries
for select
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips trip
    where trip.id = trip_itineraries.trip_id
      and public.is_trip_publicly_accessible(
        trip.owner_type,
        trip.visibility,
        trip.status,
        trip.link_activated_at,
        trip.link_access_until
      )
  )
  or exists (
    select 1
    from public.trips trip
    where trip.id = trip_itineraries.trip_id
      and (
        trip.owner_user_id = auth.uid()
        or (
          trip.agency_id is not null
          and exists (
            select 1
            from public.agency_members member
            where member.agency_id = trip.agency_id
              and member.profile_id = auth.uid()
              and member.status = 'active'
          )
        )
      )
  )
);

revoke all on table public.traveler_trip_lifecycle_events from public, anon, authenticated;
grant select, insert, update, delete on table public.traveler_trip_lifecycle_events to service_role;

revoke all on function public.calculate_traveler_trip_link_access_until(date) from public, anon, authenticated;
revoke all on function public.is_trip_publicly_accessible(text, text, text, timestamptz, timestamptz, timestamptz) from public;
revoke all on function public.enforce_traveler_trip_link_activation() from public, anon, authenticated;
revoke all on function public.audit_traveler_trip_lifecycle_change() from public, anon, authenticated;
revoke all on function public.activate_traveler_trip_with_wallet(uuid) from public, anon, service_role;

grant execute on function public.calculate_traveler_trip_link_access_until(date) to service_role;
grant execute on function public.is_trip_publicly_accessible(text, text, text, timestamptz, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.activate_traveler_trip_with_wallet(uuid) to authenticated;
