-- Unique migration version: seed products after traveler trip-link activation.
insert into public.wallet_products (
  code,
  name,
  asset_type,
  quantity,
  active,
  metadata
)
values
  (
    'trip_link_1',
    '1 viagem',
    'trip_link',
    1,
    true,
    jsonb_build_object(
      'billing_scope', 'traveler_trip_link',
      'non_expiring', true,
      'stripe_price_env', 'STRIPE_PRICE_TRAVELER_TRIP_LINK_1'
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
      'non_expiring', true,
      'stripe_price_env', 'STRIPE_PRICE_TRAVELER_TRIP_LINK_5'
    )
  ),
  (
    'trip_link_10',
    '10 viagens',
    'trip_link',
    10,
    true,
    jsonb_build_object(
      'billing_scope', 'traveler_trip_link',
      'non_expiring', true,
      'stripe_price_env', 'STRIPE_PRICE_TRAVELER_TRIP_LINK_10'
    )
  )
on conflict (code) do update
set
  name = excluded.name,
  asset_type = excluded.asset_type,
  quantity = excluded.quantity,
  active = excluded.active,
  metadata = coalesce(public.wallet_products.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();
