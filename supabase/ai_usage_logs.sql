-- Vuei operational AI usage logs
-- Run in Supabase SQL Editor to provision the real ai_usage_logs table.

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  message_id uuid references public.ai_messages(id) on delete set null,
  feature text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  credit_amount integer not null default 0,
  status text not null default 'completed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_usage_logs_feature_check check (
    feature in ('concierge', 'flight_extraction', 'itinerary_generation', 'document_extraction')
  ),
  constraint ai_usage_logs_status_check check (
    status in ('completed', 'failed', 'skipped')
  ),
  constraint ai_usage_logs_input_tokens_non_negative check (input_tokens >= 0),
  constraint ai_usage_logs_output_tokens_non_negative check (output_tokens >= 0),
  constraint ai_usage_logs_total_tokens_non_negative check (total_tokens >= 0),
  constraint ai_usage_logs_credit_amount_non_negative check (credit_amount >= 0)
);

alter table public.ai_usage_logs add column if not exists owner_user_id uuid references public.profiles(id) on delete set null;
alter table public.ai_usage_logs add column if not exists agency_id uuid references public.agencies(id) on delete set null;
alter table public.ai_usage_logs add column if not exists trip_id uuid references public.trips(id) on delete set null;
alter table public.ai_usage_logs add column if not exists conversation_id uuid references public.ai_conversations(id) on delete set null;
alter table public.ai_usage_logs add column if not exists message_id uuid references public.ai_messages(id) on delete set null;
alter table public.ai_usage_logs add column if not exists feature text;
alter table public.ai_usage_logs add column if not exists model text;
alter table public.ai_usage_logs add column if not exists input_tokens integer not null default 0;
alter table public.ai_usage_logs add column if not exists output_tokens integer not null default 0;
alter table public.ai_usage_logs add column if not exists total_tokens integer not null default 0;
alter table public.ai_usage_logs add column if not exists credit_amount integer not null default 0;
alter table public.ai_usage_logs add column if not exists status text not null default 'completed';
alter table public.ai_usage_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_usage_logs add column if not exists created_at timestamptz not null default now();

create index if not exists idx_ai_usage_logs_owner_user_id on public.ai_usage_logs (owner_user_id);
create index if not exists idx_ai_usage_logs_agency_id on public.ai_usage_logs (agency_id);
create index if not exists idx_ai_usage_logs_trip_id on public.ai_usage_logs (trip_id);
create index if not exists idx_ai_usage_logs_feature on public.ai_usage_logs (feature);
create index if not exists idx_ai_usage_logs_created_at on public.ai_usage_logs (created_at desc);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai_usage_logs_select_owner_agency_or_master" on public.ai_usage_logs;
create policy "ai_usage_logs_select_owner_agency_or_master"
on public.ai_usage_logs
for select
to authenticated
using (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_usage_logs_insert_owner_agency_or_master" on public.ai_usage_logs;
create policy "ai_usage_logs_insert_owner_agency_or_master"
on public.ai_usage_logs
for insert
to authenticated
with check (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
  or exists (
    select 1
    from public.trips
    where trips.id = ai_usage_logs.trip_id
      and (
        trips.owner_user_id = auth.uid()
        or (
          trips.agency_id is not null
          and (public.is_agency_member(trips.agency_id) or public.is_agency_owner(trips.agency_id))
        )
      )
  )
);
