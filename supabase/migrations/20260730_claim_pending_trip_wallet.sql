-- Unique migration version: requires the 20260729 wallet infrastructure migration.
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
  wallet_id uuid;
  claim_idempotency_key text;
begin
  claim_idempotency_key := format(
    'pending_claim:%s:%s',
    coalesce(p_user_id::text, ''),
    coalesce(p_claim_token_hash, '')
  );

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user_id::text, ''), 0));

  select wt.trip_id
  into existing_trip_id
  from public.wallet_transactions wt
  inner join public.wallets w
    on w.id = wt.wallet_id
  where wt.idempotency_key = claim_idempotency_key
    and wt.transaction_type = 'consume'
    and wt.asset_type = 'trip_link'
    and w.owner_type = 'traveler'
    and w.owner_user_id = p_user_id
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

  if trip_row.claim_token_expires_at is null or trip_row.claim_token_expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  wallet_id := public.ensure_wallet('traveler', p_user_id, null);

  perform public.apply_wallet_starter_grant_if_needed(
    wallet_id,
    'trip_link',
    p_user_id
  );

  begin
    update public.trips
    set
      owner_user_id = p_user_id,
      claim_token_hash = null,
      claim_token_expires_at = null,
      claim_token_claimed_at = now(),
      updated_at = now()
    where id = trip_row.id
    returning * into trip_row;

    perform public.consume_wallet_asset_for_trip(
      wallet_id,
      'trip_link',
      trip_row.id,
      p_user_id,
      'Consumo de Link da Viagem',
      'pending_trip_claim',
      claim_idempotency_key
    );
  exception
    when others then
      if SQLERRM = 'trip_link_insufficient_balance' then
        return jsonb_build_object('status', 'insufficient_balance');
      end if;
      raise;
  end;

  return jsonb_build_object(
    'status', 'claimed',
    'trip_id', trip_row.id
  );
end;
$$;
