create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  avatar_url text,
  role text not null default 'traveler',
  agency_id uuid null,
  credits_balance integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('traveler', 'agency_owner', 'agency_member', 'master')),
  constraint profiles_credits_balance_check check (credits_balance >= 0)
);

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  logo_url text,
  owner_user_id uuid references public.profiles(id) on delete set null,
  plan text not null default 'starter',
  status text not null default 'active',
  credits_balance integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agencies_plan_check check (plan in ('starter', 'pro', 'enterprise')),
  constraint agencies_status_check check (status in ('pending', 'active', 'suspended', 'archived')),
  constraint agencies_credits_balance_check check (credits_balance >= 0)
);

alter table public.profiles
  drop constraint if exists profiles_agency_id_fkey;

alter table public.profiles
  add constraint profiles_agency_id_fkey
  foreign key (agency_id) references public.agencies(id) on delete set null;

create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint agency_members_role_check check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint agency_members_status_check check (status in ('pending', 'active', 'inactive')),
  constraint agency_members_agency_profile_unique unique (agency_id, profile_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  document text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_status_check check (status in ('lead', 'active', 'inactive', 'archived'))
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  destination text not null,
  country text,
  city text,
  start_date date,
  end_date date,
  status text not null default 'upcoming',
  style text,
  owner_type text not null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  admin_token text,
  public_token text,
  admin_link text,
  public_link text,
  cover_image text,
  visibility text not null default 'private',
  travelers_count integer not null default 1,
  permissions jsonb not null default '{}'::jsonb,
  credits_summary jsonb not null default '{}'::jsonb,
  offline_enabled boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_status_check check (status in ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled')),
  constraint trips_owner_type_check check (owner_type in ('traveler', 'agency')),
  constraint trips_visibility_check check (visibility in ('private', 'public')),
  constraint trips_travelers_count_check check (travelers_count >= 1),
  constraint trips_owner_consistency_check check (
    (owner_type = 'traveler' and owner_user_id is not null)
    or
    (owner_type = 'agency' and agency_id is not null and client_id is not null)
  )
);

create unique index if not exists idx_profiles_id on public.profiles (id);
create unique index if not exists idx_agencies_slug on public.agencies (slug);
create unique index if not exists idx_trips_slug on public.trips (slug);
create unique index if not exists idx_trips_admin_token on public.trips (admin_token) where admin_token is not null;
create unique index if not exists idx_trips_public_token on public.trips (public_token) where public_token is not null;

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_trips_owner_user_id on public.trips (owner_user_id);
create index if not exists idx_trips_agency_id on public.trips (agency_id);
create index if not exists idx_trips_client_id on public.trips (client_id);
create index if not exists idx_clients_agency_id on public.clients (agency_id);
create index if not exists idx_agency_members_agency_id on public.agency_members (agency_id);
create index if not exists idx_agency_members_profile_id on public.agency_members (profile_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_agencies_updated_at on public.agencies;
create trigger set_agencies_updated_at
before update on public.agencies
for each row
execute function public.set_updated_at();

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row
execute function public.set_updated_at();

create or replace function public.is_master_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  );
$$;

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_members member
    where member.agency_id = target_agency_id
      and member.profile_id = auth.uid()
      and member.status = 'active'
  );
$$;

create or replace function public.is_agency_owner(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agencies agency
    where agency.id = target_agency_id
      and agency.owner_user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.clients enable row level security;
alter table public.trips enable row level security;

drop policy if exists "profiles_select_own_or_master" on public.profiles;
create policy "profiles_select_own_or_master"
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_master_user()
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "agencies_select_own_or_master" on public.agencies;
create policy "agencies_select_own_or_master"
on public.agencies
for select
using (
  public.is_master_user()
  or public.is_agency_member(id)
  or public.is_agency_owner(id)
);

drop policy if exists "agencies_update_owner" on public.agencies;
create policy "agencies_update_owner"
on public.agencies
for update
using (public.is_agency_owner(id))
with check (public.is_agency_owner(id));

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

comment on table public.trips is 'O acesso publico por token/link compartilhavel sera tratado em fase posterior com politicas e filtros dedicados.';
