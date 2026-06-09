-- Vuei operational flight persistence
-- Run in Supabase SQL Editor after the base schema.
-- This keeps trip_flights as the single source of truth for extracted/manual
-- flight records linked to trips and uploaded ticket documents.

create table if not exists public.trip_flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  airline text,
  flight_number text,
  booking_reference text,
  origin_airport text,
  destination_airport text,
  departure_at timestamptz,
  arrival_at timestamptz,
  passenger_name text,
  qr_code_payload text,
  baggage_info text,
  terminal text,
  gate text,
  seat text,
  extracted_data jsonb not null default '{}'::jsonb,
  extraction_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_flights_extraction_status_check check (
    extraction_status in ('pending', 'processing', 'completed', 'failed', 'manual')
  )
);

alter table public.trip_flights add column if not exists trip_id uuid references public.trips(id) on delete cascade;
alter table public.trip_flights add column if not exists document_id uuid references public.documents(id) on delete set null;
alter table public.trip_flights add column if not exists airline text;
alter table public.trip_flights add column if not exists flight_number text;
alter table public.trip_flights add column if not exists booking_reference text;
alter table public.trip_flights add column if not exists origin_airport text;
alter table public.trip_flights add column if not exists destination_airport text;
alter table public.trip_flights add column if not exists departure_at timestamptz;
alter table public.trip_flights add column if not exists arrival_at timestamptz;
alter table public.trip_flights add column if not exists passenger_name text;
alter table public.trip_flights add column if not exists qr_code_payload text;
alter table public.trip_flights add column if not exists baggage_info text;
alter table public.trip_flights add column if not exists terminal text;
alter table public.trip_flights add column if not exists gate text;
alter table public.trip_flights add column if not exists seat text;
alter table public.trip_flights add column if not exists extracted_data jsonb not null default '{}'::jsonb;
alter table public.trip_flights add column if not exists extraction_status text not null default 'pending';
alter table public.trip_flights add column if not exists created_at timestamptz not null default now();
alter table public.trip_flights add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_trip_flights_trip_id on public.trip_flights (trip_id);
create index if not exists idx_trip_flights_document_id on public.trip_flights (document_id);
create index if not exists idx_trip_flights_departure_at on public.trip_flights (departure_at);
create index if not exists idx_trip_flights_extraction_status on public.trip_flights (extraction_status);

drop trigger if exists set_trip_flights_updated_at on public.trip_flights;
create trigger set_trip_flights_updated_at
before update on public.trip_flights
for each row execute function public.set_updated_at();

alter table public.trip_flights enable row level security;

drop policy if exists "trip_flights_select_owner_agency_or_master" on public.trip_flights;
create policy "trip_flights_select_owner_agency_or_master"
on public.trip_flights
for select
to authenticated
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips
    where trips.id = trip_flights.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null
          and (public.is_agency_member(trips.agency_id) or public.is_agency_owner(trips.agency_id))
        )
        or trips.visibility = 'public'
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
    from public.trips
    where trips.id = trip_flights.trip_id
      and trips.visibility = 'public'
  )
);

drop policy if exists "trip_flights_insert_owner_or_agency" on public.trip_flights;
create policy "trip_flights_insert_owner_or_agency"
on public.trip_flights
for insert
to authenticated
with check (
  exists (
    select 1
    from public.trips
    where trips.id = trip_flights.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null
          and (public.is_agency_member(trips.agency_id) or public.is_agency_owner(trips.agency_id))
        )
      )
  )
);

drop policy if exists "trip_flights_update_owner_or_agency" on public.trip_flights;
create policy "trip_flights_update_owner_or_agency"
on public.trip_flights
for update
to authenticated
using (
  exists (
    select 1
    from public.trips
    where trips.id = trip_flights.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null
          and (public.is_agency_member(trips.agency_id) or public.is_agency_owner(trips.agency_id))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.trips
    where trips.id = trip_flights.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null
          and (public.is_agency_member(trips.agency_id) or public.is_agency_owner(trips.agency_id))
        )
      )
  )
);

drop policy if exists "trip_flights_delete_owner_or_agency" on public.trip_flights;
create policy "trip_flights_delete_owner_or_agency"
on public.trip_flights
for delete
to authenticated
using (
  exists (
    select 1
    from public.trips
    where trips.id = trip_flights.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null
          and (public.is_agency_member(trips.agency_id) or public.is_agency_owner(trips.agency_id))
        )
      )
  )
);
