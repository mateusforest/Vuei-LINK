-- Vuei phase 2 fix: permissões mínimas para criação real de agências no frontend.
-- Execute após supabase/schema.sql.

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;

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

drop policy if exists "agency_members_insert_owner_or_master" on public.agency_members;
create policy "agency_members_insert_owner_or_master"
on public.agency_members
for insert
with check (
  public.is_master_user()
  or (
    profile_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1
      from public.agencies agency
      where agency.id = agency_members.agency_id
        and agency.owner_user_id = auth.uid()
    )
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
