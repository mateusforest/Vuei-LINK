-- LEGADO PARCIAL
-- Este arquivo ainda e util como referencia historica para ai_conversations, ai_messages e ai_prompts,
-- mas o bloco de ai_usage_logs aqui nao representa mais o schema usado em runtime.
-- Para ai_usage_logs, a referencia atual e supabase/ai_usage_logs.sql.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  channel text not null,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_channel_check check (channel in ('concierge', 'itinerary', 'documents', 'ticket_reader')),
  constraint ai_conversations_status_check check (status in ('open', 'closed', 'archived'))
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  role text not null,
  content text not null,
  credits_used integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_messages_role_check check (role in ('user', 'assistant', 'agent', 'system')),
  constraint ai_messages_credits_used_check check (credits_used >= 0)
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  module text not null,
  action text not null,
  credits_used integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_usage_logs_module_check check (module in ('concierge', 'itinerary', 'documents', 'ticket_reader', 'accommodation_reader', 'flight_reader')),
  constraint ai_usage_logs_credits_used_check check (credits_used >= 0)
);

create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  module text not null,
  system_prompt text not null,
  user_prompt_template text,
  is_active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_prompts_code_unique unique (code),
  constraint ai_prompts_module_check check (module in ('concierge', 'itinerary', 'documents', 'ticket_reader', 'accommodation_reader', 'flight_reader')),
  constraint ai_prompts_version_check check (version >= 1)
);

create index if not exists idx_ai_conversations_trip_id on public.ai_conversations (trip_id);
create index if not exists idx_ai_conversations_user_id on public.ai_conversations (user_id);
create index if not exists idx_ai_conversations_agency_id on public.ai_conversations (agency_id);
create index if not exists idx_ai_conversations_client_id on public.ai_conversations (client_id);
create index if not exists idx_ai_messages_conversation_id on public.ai_messages (conversation_id);
create index if not exists idx_ai_messages_trip_id on public.ai_messages (trip_id);
create index if not exists idx_ai_usage_logs_trip_id on public.ai_usage_logs (trip_id);
create index if not exists idx_ai_usage_logs_user_id on public.ai_usage_logs (user_id);
create index if not exists idx_ai_usage_logs_agency_id on public.ai_usage_logs (agency_id);
create index if not exists idx_ai_usage_logs_module on public.ai_usage_logs (module);
create index if not exists idx_ai_prompts_code on public.ai_prompts (code);
create index if not exists idx_ai_prompts_module on public.ai_prompts (module);

drop trigger if exists set_ai_conversations_updated_at on public.ai_conversations;
create trigger set_ai_conversations_updated_at
before update on public.ai_conversations
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_prompts_updated_at on public.ai_prompts;
create trigger set_ai_prompts_updated_at
before update on public.ai_prompts
for each row
execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_prompts enable row level security;

drop policy if exists "ai_conversations_select_owner_agency_or_master" on public.ai_conversations;
create policy "ai_conversations_select_owner_agency_or_master"
on public.ai_conversations
for select
using (
  public.is_master_user()
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_conversations.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_conversations_insert_owner_or_agency" on public.ai_conversations;
create policy "ai_conversations_insert_owner_or_agency"
on public.ai_conversations
for insert
with check (
  public.is_master_user()
  or (
    trip_id is not null
    and user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_conversations.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_conversations_update_owner_or_agency" on public.ai_conversations;
create policy "ai_conversations_update_owner_or_agency"
on public.ai_conversations
for update
using (
  public.is_master_user()
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_conversations.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
)
with check (
  public.is_master_user()
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_conversations.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_messages_select_owner_agency_or_master" on public.ai_messages;
create policy "ai_messages_select_owner_agency_or_master"
on public.ai_messages
for select
using (
  public.is_master_user()
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_messages.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_messages_insert_owner_agency_or_master" on public.ai_messages;
create policy "ai_messages_insert_owner_agency_or_master"
on public.ai_messages
for insert
with check (
  public.is_master_user()
  or (
    trip_id is not null
    and (
      (role = 'user' and user_id = auth.uid())
      or role in ('assistant', 'system')
    )
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_messages.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_usage_logs_select_owner_agency_or_master" on public.ai_usage_logs;
create policy "ai_usage_logs_select_owner_agency_or_master"
on public.ai_usage_logs
for select
using (
  public.is_master_user()
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_usage_logs.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_usage_logs_insert_owner_agency_or_master" on public.ai_usage_logs;
create policy "ai_usage_logs_insert_owner_agency_or_master"
on public.ai_usage_logs
for insert
with check (
  public.is_master_user()
  or (
    trip_id is not null
    and user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_usage_logs.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "ai_prompts_select_active_or_master" on public.ai_prompts;
create policy "ai_prompts_select_active_or_master"
on public.ai_prompts
for select
using (
  is_active = true
  or public.is_master_user()
);

drop policy if exists "ai_prompts_insert_master" on public.ai_prompts;
create policy "ai_prompts_insert_master"
on public.ai_prompts
for insert
with check (public.is_master_user());

drop policy if exists "ai_prompts_update_master" on public.ai_prompts;
create policy "ai_prompts_update_master"
on public.ai_prompts
for update
using (public.is_master_user())
with check (public.is_master_user());
