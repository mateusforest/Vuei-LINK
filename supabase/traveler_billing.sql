create table if not exists public.traveler_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null default 'free',
  status text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traveler_subscriptions_user_id_key unique (user_id),
  constraint traveler_subscriptions_plan_code_check check (plan_code in ('free', 'premium')),
  constraint traveler_subscriptions_status_check check (status in ('free', 'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'))
);

create index if not exists idx_traveler_subscriptions_user_id
  on public.traveler_subscriptions (user_id);

create index if not exists idx_traveler_subscriptions_customer_id
  on public.traveler_subscriptions (stripe_customer_id);

create index if not exists idx_traveler_subscriptions_subscription_id
  on public.traveler_subscriptions (stripe_subscription_id);

create table if not exists public.traveler_plan_credit_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.traveler_subscriptions(id) on delete set null,
  plan_code text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  granted_credits integer not null,
  used_credits integer not null default 0,
  expired_credits integer not null default 0,
  stripe_invoice_id text,
  created_at timestamptz not null default now(),
  constraint traveler_plan_credit_cycles_plan_code_check check (plan_code in ('free', 'premium')),
  constraint traveler_plan_credit_cycles_granted_non_negative_check check (granted_credits >= 0),
  constraint traveler_plan_credit_cycles_used_non_negative_check check (used_credits >= 0),
  constraint traveler_plan_credit_cycles_expired_non_negative_check check (expired_credits >= 0),
  constraint traveler_plan_credit_cycles_remaining_check check (used_credits + expired_credits <= granted_credits)
);

create unique index if not exists idx_traveler_plan_credit_cycles_unique_period
  on public.traveler_plan_credit_cycles (user_id, plan_code, period_start, period_end);

create unique index if not exists idx_traveler_plan_credit_cycles_invoice
  on public.traveler_plan_credit_cycles (stripe_invoice_id)
  where stripe_invoice_id is not null;

create index if not exists idx_traveler_plan_credit_cycles_user_id
  on public.traveler_plan_credit_cycles (user_id, period_start desc);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_stripe_events_processed_at
  on public.stripe_events (processed_at desc);

alter table public.traveler_subscriptions enable row level security;
alter table public.traveler_plan_credit_cycles enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists "traveler_subscriptions_select_own" on public.traveler_subscriptions;
create policy "traveler_subscriptions_select_own"
on public.traveler_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "traveler_plan_credit_cycles_select_own" on public.traveler_plan_credit_cycles;
create policy "traveler_plan_credit_cycles_select_own"
on public.traveler_plan_credit_cycles
for select
to authenticated
using (auth.uid() = user_id);
