create table if not exists public.agency_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  plan_code text not null default 'free',
  status text not null default 'active',
  started_at timestamptz,
  expires_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agency_subscriptions_agency_id_key unique (agency_id),
  constraint agency_subscriptions_plan_code_check check (plan_code in ('free', 'start', 'pro', 'business')),
  constraint agency_subscriptions_status_check check (status in ('active', 'inactive', 'cancelled', 'incomplete', 'trialing', 'past_due', 'canceled', 'unpaid'))
);

alter table public.agency_subscriptions
  add column if not exists stripe_customer_id text;

alter table public.agency_subscriptions
  add column if not exists stripe_subscription_id text;

alter table public.agency_subscriptions
  add column if not exists stripe_price_id text;

alter table public.agency_subscriptions
  add column if not exists current_period_start timestamptz;

alter table public.agency_subscriptions
  add column if not exists current_period_end timestamptz;

alter table public.agency_subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.agency_subscriptions
  alter column plan_code set default 'free';

alter table public.agency_subscriptions
  drop constraint if exists agency_subscriptions_plan_code_check;

alter table public.agency_subscriptions
  add constraint agency_subscriptions_plan_code_check
  check (plan_code in ('free', 'start', 'pro', 'business'));

alter table public.agency_subscriptions
  drop constraint if exists agency_subscriptions_status_check;

alter table public.agency_subscriptions
  add constraint agency_subscriptions_status_check
  check (status in ('active', 'inactive', 'cancelled', 'incomplete', 'trialing', 'past_due', 'canceled', 'unpaid'));

create index if not exists agency_subscriptions_plan_code_idx
  on public.agency_subscriptions (plan_code);

create unique index if not exists agency_subscriptions_stripe_customer_id_idx
  on public.agency_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists agency_subscriptions_stripe_subscription_id_idx
  on public.agency_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.agency_plan_credit_cycles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  subscription_id uuid references public.agency_subscriptions(id) on delete set null,
  plan_code text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  granted_credits integer not null,
  used_credits integer not null default 0,
  stripe_invoice_id text unique,
  created_at timestamptz not null default timezone('utc', now()),
  constraint agency_plan_credit_cycles_plan_code_check check (plan_code in ('free', 'start', 'pro', 'business')),
  constraint agency_plan_credit_cycles_granted_credits_check check (granted_credits >= 0),
  constraint agency_plan_credit_cycles_used_credits_check check (used_credits >= 0 and used_credits <= granted_credits)
);

create index if not exists agency_plan_credit_cycles_agency_period_idx
  on public.agency_plan_credit_cycles (agency_id, period_start desc);

alter table public.agency_plan_credit_cycles enable row level security;

drop policy if exists "Agency credit cycles select own agency" on public.agency_plan_credit_cycles;
create policy "Agency credit cycles select own agency"
  on public.agency_plan_credit_cycles
  for select
  using (
    exists (
      select 1
      from public.agencies a
      where a.id = agency_plan_credit_cycles.agency_id
        and a.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.agency_members am
      where am.agency_id = agency_plan_credit_cycles.agency_id
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

-- Query segura opcional para ambientes sem Stripe:
-- rebaixa apenas subscriptions canônicas criadas automaticamente como start,
-- mantendo espaço para preservar casos ajustados manualmente.
-- update public.agency_subscriptions
-- set plan_code = 'free',
--     updated_at = timezone('utc', now())
-- where plan_code = 'start'
--   and status = 'active'
--   and started_at is not null
--   and expires_at is null;
