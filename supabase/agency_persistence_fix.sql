-- Vuei agency persistence fix
-- Review manually before executing in the Supabase SQL Editor.
-- This SQL is intentionally non-destructive and only adjusts RLS policies
-- required for real persistence of agencies, agency members, clients and trips.

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.clients enable row level security;
alter table public.trips enable row level security;

drop policy if exists "agencies_select_own_or_master" on public.agencies;
create policy "agencies_select_own_or_master"
on public.agencies
for select
using (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or public.is_agency_member(id)
);

drop policy if exists "agencies_insert_owner" on public.agencies;
create policy "agencies_insert_owner"
on public.agencies
for insert
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('agency_owner', 'master')
  )
);

drop policy if exists "agencies_update_owner" on public.agencies;
create policy "agencies_update_owner"
on public.agencies
for update
using (
  public.is_master_user()
  or owner_user_id = auth.uid()
)
with check (
  public.is_master_user()
  or owner_user_id = auth.uid()
);

drop policy if exists "agency_members_select_same_agency_or_master" on public.agency_members;
create policy "agency_members_select_same_agency_or_master"
on public.agency_members
for select
using (
  public.is_master_user()
  or profile_id = auth.uid()
  or public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "agency_members_insert_owner_or_master" on public.agency_members;
create policy "agency_members_insert_owner_or_master"
on public.agency_members
for insert
with check (
  public.is_master_user()
  or (
    profile_id = auth.uid()
    and role = 'owner'
    and public.is_agency_owner(agency_id)
  )
);

drop policy if exists "agency_members_update_owner_or_master" on public.agency_members;
create policy "agency_members_update_owner_or_master"
on public.agency_members
for update
using (
  public.is_master_user()
  or public.is_agency_owner(agency_id)
)
with check (
  public.is_master_user()
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_select_same_agency_or_master" on public.clients;
create policy "clients_select_same_agency_or_master"
on public.clients
for select
using (
  public.is_master_user()
  or public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_insert_same_agency" on public.clients;
create policy "clients_insert_same_agency"
on public.clients
for insert
with check (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_update_same_agency" on public.clients;
create policy "clients_update_same_agency"
on public.clients
for update
using (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
)
with check (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "clients_delete_same_agency" on public.clients;
create policy "clients_delete_same_agency"
on public.clients
for delete
using (
  public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "trips_select_owner_agency_or_master" on public.trips;
create policy "trips_select_owner_agency_or_master"
on public.trips
for select
using (
  public.is_master_user()
  or (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
);

drop policy if exists "trips_insert_owner_or_agency" on public.trips;
create policy "trips_insert_owner_or_agency"
on public.trips
for insert
with check (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
);

drop policy if exists "trips_update_owner_or_agency" on public.trips;
create policy "trips_update_owner_or_agency"
on public.trips
for update
using (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
)
with check (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
);

drop policy if exists "trips_delete_owner_or_agency" on public.trips;
create policy "trips_delete_owner_or_agency"
on public.trips
for delete
using (
  (owner_type = 'traveler' and owner_user_id = auth.uid())
  or (owner_type = 'agency' and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id)))
);
