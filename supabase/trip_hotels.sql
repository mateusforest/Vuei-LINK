create table if not exists public.trip_hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  address text,
  check_in text,
  check_out text,
  confirmation_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id)
);

create index if not exists trip_hotels_trip_id_idx on public.trip_hotels(trip_id);

create trigger set_trip_hotels_updated_at
before update on public.trip_hotels
for each row execute function public.set_updated_at();

alter table public.trip_hotels enable row level security;

create policy "trip_hotels_select_owner"
on public.trip_hotels
for select
to authenticated
using (
  exists (
    select 1 from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
);

create policy "trip_hotels_insert_owner"
on public.trip_hotels
for insert
to authenticated
with check (
  exists (
    select 1 from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
);

create policy "trip_hotels_update_owner"
on public.trip_hotels
for update
to authenticated
using (
  exists (
    select 1 from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
)
with check (
  exists (
    select 1 from public.trips
    where trips.id = trip_hotels.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null and exists (
            select 1 from public.agency_members
            where agency_members.agency_id = trips.agency_id
              and agency_members.profile_id = auth.uid()
              and agency_members.status = 'active'
          )
        )
      )
  )
);
