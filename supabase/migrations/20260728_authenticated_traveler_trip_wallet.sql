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
