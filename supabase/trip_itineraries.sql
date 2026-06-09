create table if not exists public.trip_itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  mode text not null check (mode in ('simple', 'complete_pdf', 'uploaded')),
  status text not null default 'draft' check (status in ('draft', 'generating', 'completed', 'failed', 'uploaded')),
  content jsonb not null default '{"days":[]}'::jsonb,
  pdf_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_itineraries_trip_id_idx on public.trip_itineraries(trip_id);
create index if not exists trip_itineraries_document_id_idx on public.trip_itineraries(document_id);
create index if not exists trip_itineraries_mode_idx on public.trip_itineraries(mode);

drop trigger if exists set_trip_itineraries_updated_at on public.trip_itineraries;
create trigger set_trip_itineraries_updated_at
before update on public.trip_itineraries
for each row
execute function public.set_updated_at();

alter table public.trip_itineraries enable row level security;

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
      and trip.visibility = 'public'
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

drop policy if exists "trip_itineraries_insert" on public.trip_itineraries;
create policy "trip_itineraries_insert"
on public.trip_itineraries
for insert
with check (
  public.is_master_user()
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
              and member.role in ('owner', 'admin', 'member')
          )
        )
      )
  )
);

drop policy if exists "trip_itineraries_update" on public.trip_itineraries;
create policy "trip_itineraries_update"
on public.trip_itineraries
for update
using (
  public.is_master_user()
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
              and member.role in ('owner', 'admin', 'member')
          )
        )
      )
  )
)
with check (
  public.is_master_user()
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
              and member.role in ('owner', 'admin', 'member')
          )
        )
      )
  )
);

drop policy if exists "trip_itineraries_delete" on public.trip_itineraries;
create policy "trip_itineraries_delete"
on public.trip_itineraries
for delete
using (
  public.is_master_user()
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
              and member.role in ('owner', 'admin')
          )
        )
      )
  )
);
