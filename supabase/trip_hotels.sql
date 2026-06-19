-- Vuei phase 1 stabilization for trip_hotels
-- Review manually before running in Supabase SQL Editor.
-- This SQL aligns the table with the current UI, which supports
-- multiple hospedagens por viagem and real delete operations.

create table if not exists public.trip_hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  address text,
  check_in text,
  check_out text,
  confirmation_code text,
  document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_hotels add column if not exists name text;
alter table public.trip_hotels add column if not exists address text;
alter table public.trip_hotels add column if not exists check_in text;
alter table public.trip_hotels add column if not exists check_out text;
alter table public.trip_hotels add column if not exists confirmation_code text;
alter table public.trip_hotels add column if not exists document_id uuid references public.documents(id) on delete set null;
alter table public.trip_hotels add column if not exists notes text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trip_hotels'
      and column_name = 'hotel_name'
  ) then
    execute '
      update public.trip_hotels
      set name = coalesce(name, hotel_name)
      where coalesce(name, '''') = ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trip_hotels'
      and column_name = 'confirmation_number'
  ) then
    execute '
      update public.trip_hotels
      set confirmation_code = coalesce(confirmation_code, confirmation_number)
      where confirmation_code is null
    ';
  end if;
end $$;

alter table public.trip_hotels drop constraint if exists trip_hotels_trip_id_key;

create index if not exists trip_hotels_trip_id_idx on public.trip_hotels(trip_id);
create index if not exists trip_hotels_document_id_idx on public.trip_hotels(document_id);

drop trigger if exists set_trip_hotels_updated_at on public.trip_hotels;
create trigger set_trip_hotels_updated_at
before update on public.trip_hotels
for each row execute function public.set_updated_at();

alter table public.trip_hotels enable row level security;

drop policy if exists "trip_hotels_select_owner" on public.trip_hotels;
drop policy if exists "trip_hotels_insert_owner" on public.trip_hotels;
drop policy if exists "trip_hotels_update_owner" on public.trip_hotels;
drop policy if exists "trip_hotels_delete_owner" on public.trip_hotels;

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

create policy "trip_hotels_delete_owner"
on public.trip_hotels
for delete
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
