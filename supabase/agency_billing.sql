create table if not exists public.agency_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  plan_code text not null default 'start',
  status text not null default 'active',
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agency_subscriptions_agency_id_key unique (agency_id),
  constraint agency_subscriptions_plan_code_check check (plan_code in ('start', 'pro', 'business')),
  constraint agency_subscriptions_status_check check (status in ('active', 'inactive', 'cancelled'))
);

create index if not exists agency_subscriptions_plan_code_idx
  on public.agency_subscriptions (plan_code);

alter table public.agency_subscriptions enable row level security;

drop policy if exists "Agency subscriptions select own agency" on public.agency_subscriptions;
create policy "Agency subscriptions select own agency"
  on public.agency_subscriptions
  for select
  using (
    exists (
      select 1
      from public.agencies a
      where a.id = agency_subscriptions.agency_id
        and a.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.agency_members am
      where am.agency_id = agency_subscriptions.agency_id
        and am.profile_id = auth.uid()
        and am.status = 'active'
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'master'
    )
  );

drop policy if exists "Agency subscriptions manage own agency" on public.agency_subscriptions;
create policy "Agency subscriptions manage own agency"
  on public.agency_subscriptions
  for all
  using (
    exists (
      select 1
      from public.agencies a
      where a.id = agency_subscriptions.agency_id
        and a.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.agency_members am
      where am.agency_id = agency_subscriptions.agency_id
        and am.profile_id = auth.uid()
        and am.role in ('owner', 'admin')
        and am.status = 'active'
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'master'
    )
  )
  with check (
    exists (
      select 1
      from public.agencies a
      where a.id = agency_subscriptions.agency_id
        and a.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.agency_members am
      where am.agency_id = agency_subscriptions.agency_id
        and am.profile_id = auth.uid()
        and am.role in ('owner', 'admin')
        and am.status = 'active'
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'master'
    )
  );
