-- Vuei AI operational fix
-- Nao executar automaticamente.
-- Revise no Supabase SQL Editor antes de aplicar.

create extension if not exists pgcrypto;

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  owner_type text null,
  owner_user_id uuid null references public.profiles(id) on delete set null,
  trip_id uuid null references public.trips(id) on delete set null,
  user_id uuid null references public.profiles(id) on delete set null,
  agency_id uuid null references public.agencies(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  module text not null,
  action text not null,
  model text null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost numeric(12,6) null,
  credits_charged integer not null default 0,
  credits_used integer not null default 0,
  status text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_logs add column if not exists owner_type text;
alter table public.ai_usage_logs add column if not exists owner_user_id uuid references public.profiles(id) on delete set null;
alter table public.ai_usage_logs add column if not exists trip_id uuid references public.trips(id) on delete set null;
alter table public.ai_usage_logs add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.ai_usage_logs add column if not exists agency_id uuid references public.agencies(id) on delete set null;
alter table public.ai_usage_logs add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.ai_usage_logs add column if not exists module text;
alter table public.ai_usage_logs add column if not exists action text;
alter table public.ai_usage_logs add column if not exists model text;
alter table public.ai_usage_logs add column if not exists input_tokens integer not null default 0;
alter table public.ai_usage_logs add column if not exists output_tokens integer not null default 0;
alter table public.ai_usage_logs add column if not exists total_tokens integer not null default 0;
alter table public.ai_usage_logs add column if not exists estimated_cost numeric(12,6);
alter table public.ai_usage_logs add column if not exists credits_charged integer not null default 0;
alter table public.ai_usage_logs add column if not exists credits_used integer not null default 0;
alter table public.ai_usage_logs add column if not exists status text not null default 'success';
alter table public.ai_usage_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_usage_logs add column if not exists created_at timestamptz not null default now();

update public.ai_usage_logs
set owner_type = case
  when owner_type is not null then owner_type
  when agency_id is not null then 'agency'
  else 'traveler'
end,
    owner_user_id = coalesce(owner_user_id, user_id),
    input_tokens = coalesce(input_tokens, 0),
    output_tokens = coalesce(output_tokens, 0),
    total_tokens = coalesce(total_tokens, input_tokens, 0) + coalesce(output_tokens, 0),
    credits_charged = coalesce(credits_charged, credits_used, 0),
    credits_used = coalesce(credits_used, credits_charged, 0),
    status = coalesce(status, 'success')
where owner_type is null
   or owner_user_id is null
   or input_tokens is null
   or output_tokens is null
   or total_tokens is null
   or credits_charged is null
   or credits_used is null
   or status is null;

do $$
begin
  alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_module_check;
  alter table public.ai_usage_logs
    add constraint ai_usage_logs_module_check
    check (module in ('concierge', 'itinerary', 'documents', 'ticket_reader', 'accommodation_reader', 'flight_reader', 'support_assistant'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_owner_type_check;
  alter table public.ai_usage_logs
    add constraint ai_usage_logs_owner_type_check
    check (owner_type in ('traveler', 'agency') or owner_type is null);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_status_check;
  alter table public.ai_usage_logs
    add constraint ai_usage_logs_status_check
    check (status in ('success', 'error', 'blocked', 'insufficient_credits'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_input_tokens_non_negative;
  alter table public.ai_usage_logs
    add constraint ai_usage_logs_input_tokens_non_negative
    check (input_tokens >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_output_tokens_non_negative;
  alter table public.ai_usage_logs
    add constraint ai_usage_logs_output_tokens_non_negative
    check (output_tokens >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_total_tokens_non_negative;
  alter table public.ai_usage_logs
    add constraint ai_usage_logs_total_tokens_non_negative
    check (total_tokens >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_credits_charged_non_negative;
  alter table public.ai_usage_logs
    add constraint ai_usage_logs_credits_charged_non_negative
    check (credits_charged >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_credits_used_non_negative;
  alter table public.ai_usage_logs
    add constraint ai_usage_logs_credits_used_non_negative
    check (credits_used >= 0);
exception when duplicate_object then null;
end $$;

create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  module text not null,
  system_prompt text not null,
  user_prompt_template text null,
  is_active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_prompts add column if not exists code text;
alter table public.ai_prompts add column if not exists name text;
alter table public.ai_prompts add column if not exists module text;
alter table public.ai_prompts add column if not exists system_prompt text;
alter table public.ai_prompts add column if not exists user_prompt_template text;
alter table public.ai_prompts add column if not exists is_active boolean not null default true;
alter table public.ai_prompts add column if not exists version integer not null default 1;
alter table public.ai_prompts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_prompts add column if not exists created_at timestamptz not null default now();
alter table public.ai_prompts add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.ai_prompts drop constraint if exists ai_prompts_module_check;
  alter table public.ai_prompts
    add constraint ai_prompts_module_check
    check (module in ('concierge', 'itinerary', 'documents', 'ticket_reader', 'accommodation_reader', 'flight_reader', 'support_assistant'));
exception when duplicate_object then null;
end $$;

create unique index if not exists idx_ai_prompts_code on public.ai_prompts (code);
create index if not exists idx_ai_prompts_module on public.ai_prompts (module);
create index if not exists idx_ai_usage_logs_trip_id on public.ai_usage_logs (trip_id);
create index if not exists idx_ai_usage_logs_agency_id on public.ai_usage_logs (agency_id);
create index if not exists idx_ai_usage_logs_owner_user_id on public.ai_usage_logs (owner_user_id);
create index if not exists idx_ai_usage_logs_module on public.ai_usage_logs (module);
create index if not exists idx_ai_usage_logs_status on public.ai_usage_logs (status);
create index if not exists idx_ai_usage_logs_created_at on public.ai_usage_logs (created_at desc);

drop trigger if exists set_ai_prompts_updated_at on public.ai_prompts;
create trigger set_ai_prompts_updated_at
before update on public.ai_prompts
for each row execute function public.set_updated_at();

alter table public.ai_usage_logs enable row level security;
alter table public.ai_prompts enable row level security;

drop policy if exists "ai_usage_logs_select_owner_agency_or_master" on public.ai_usage_logs;
create policy "ai_usage_logs_select_owner_agency_or_master"
on public.ai_usage_logs
for select
to authenticated
using (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_usage_logs.trip_id
        and (
          trip.owner_user_id = auth.uid()
          or (
            trip.agency_id is not null
            and (public.is_agency_owner(trip.agency_id) or public.is_agency_member(trip.agency_id))
          )
        )
    )
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
  or user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_usage_logs.trip_id
        and (
          trip.owner_user_id = auth.uid()
          or (
            trip.agency_id is not null
            and (public.is_agency_owner(trip.agency_id) or public.is_agency_member(trip.agency_id))
          )
        )
    )
  )
);

drop policy if exists "ai_prompts_select_active_or_master" on public.ai_prompts;
create policy "ai_prompts_select_active_or_master"
on public.ai_prompts
for select
to authenticated
using (
  is_active = true
  or public.is_master_user()
);

drop policy if exists "ai_prompts_insert_master" on public.ai_prompts;
create policy "ai_prompts_insert_master"
on public.ai_prompts
for insert
to authenticated
with check (public.is_master_user());

drop policy if exists "ai_prompts_update_master" on public.ai_prompts;
create policy "ai_prompts_update_master"
on public.ai_prompts
for update
to authenticated
using (public.is_master_user())
with check (public.is_master_user());

insert into public.ai_prompts (
  code,
  name,
  module,
  system_prompt,
  user_prompt_template,
  is_active,
  version,
  metadata
)
values
  (
    'concierge_traveler',
    'Concierge Traveler',
    'concierge',
    'Voce e o Concierge Vuei para viajantes. Use apenas o contexto real da viagem, sem inventar dados ausentes.',
    '{message}' || chr(10) || chr(10) || 'Contexto real:' || chr(10) || '{context}',
    true,
    1,
    jsonb_build_object('audience', 'traveler')
  ),
  (
    'concierge_agency',
    'Concierge Agency',
    'concierge',
    'Voce e o Concierge Vuei em contexto de agencia. Responda com base somente no contexto real da viagem e sinalize qualquer lacuna.',
    '{message}' || chr(10) || chr(10) || 'Contexto real:' || chr(10) || '{context}',
    true,
    1,
    jsonb_build_object('audience', 'agency')
  ),
  (
    'itinerary_generator',
    'Itinerary Generator',
    'itinerary',
    'Gere roteiros apenas quando houver contexto suficiente e deixe explicito o que nao estiver disponivel.',
    '{message}',
    true,
    1,
    '{}'::jsonb
  ),
  (
    'document_reader',
    'Document Reader',
    'documents',
    'Extraia somente informacoes presentes no documento real fornecido, sem completar dados ausentes por inferencia.',
    '{message}',
    true,
    1,
    '{}'::jsonb
  ),
  (
    'support_assistant',
    'Support Assistant',
    'support_assistant',
    'Voce e o assistente interno do Vuei. Ajude com base no contexto operacional real e deixe claros os limites do sistema.',
    '{message}',
    true,
    1,
    '{}'::jsonb
  )
on conflict (code) do update
set
  name = excluded.name,
  module = excluded.module,
  system_prompt = excluded.system_prompt,
  user_prompt_template = excluded.user_prompt_template,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  updated_at = now();
