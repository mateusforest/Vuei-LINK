alter table public.trips
  add column if not exists claim_token_hash text,
  add column if not exists claim_token_expires_at timestamptz,
  add column if not exists claim_token_claimed_at timestamptz;

drop index if exists idx_trips_claim_token_hash;
create unique index if not exists idx_trips_claim_token_hash
  on public.trips (claim_token_hash)
  where claim_token_hash is not null;

alter table public.trips
  drop constraint if exists trips_owner_consistency_check;

alter table public.trips
  add constraint trips_owner_consistency_check check (
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
  );

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
