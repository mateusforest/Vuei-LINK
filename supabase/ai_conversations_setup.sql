-- Vuei Concierge schema setup
-- Nao executar automaticamente.
-- Revise primeiro no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid null references public.trips(id) on delete cascade,
  client_id uuid null references public.clients(id) on delete set null,
  agency_id uuid null references public.agencies(id) on delete set null,
  owner_user_id uuid null references public.profiles(id) on delete set null,
  source text not null,
  status text not null default 'open',
  title text null,
  last_message text null,
  last_message_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_source_check check (source in ('concierge', 'itinerary', 'documents', 'ticket_reader')),
  constraint ai_conversations_status_check check (status in ('open', 'closed', 'archived'))
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_messages_role_check check (role in ('user', 'assistant', 'agent', 'system'))
);

create index if not exists idx_ai_conversations_trip_id on public.ai_conversations (trip_id);
create index if not exists idx_ai_conversations_agency_id on public.ai_conversations (agency_id);
create index if not exists idx_ai_conversations_owner_user_id on public.ai_conversations (owner_user_id);
create index if not exists idx_ai_conversations_created_at on public.ai_conversations (created_at desc);
create index if not exists idx_ai_conversations_last_message_at on public.ai_conversations (last_message_at desc nulls last);
create index if not exists idx_ai_messages_conversation_id on public.ai_messages (conversation_id);
create index if not exists idx_ai_messages_created_at on public.ai_messages (created_at desc);

drop trigger if exists set_ai_conversations_updated_at on public.ai_conversations;
create trigger set_ai_conversations_updated_at
before update on public.ai_conversations
for each row
execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "ai_conversations_select_master" on public.ai_conversations;
create policy "ai_conversations_select_master"
on public.ai_conversations
for select
to authenticated
using (public.is_master_user());

drop policy if exists "ai_conversations_select_owner" on public.ai_conversations;
create policy "ai_conversations_select_owner"
on public.ai_conversations
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or (
    trip_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = ai_conversations.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
);

drop policy if exists "ai_conversations_select_agency" on public.ai_conversations;
create policy "ai_conversations_select_agency"
on public.ai_conversations
for select
to authenticated
using (
  agency_id is not null
  and (
    public.is_agency_owner(agency_id)
    or public.is_agency_member(agency_id)
    or exists (
      select 1
      from public.trips trip
      where trip.id = ai_conversations.trip_id
        and trip.agency_id = ai_conversations.agency_id
        and (public.is_agency_owner(trip.agency_id) or public.is_agency_member(trip.agency_id))
    )
    or exists (
      select 1
      from public.clients client
      where client.id = ai_conversations.client_id
        and client.agency_id = ai_conversations.agency_id
        and (public.is_agency_owner(client.agency_id) or public.is_agency_member(client.agency_id))
    )
  )
);

drop policy if exists "ai_conversations_insert_owner" on public.ai_conversations;
create policy "ai_conversations_insert_owner"
on public.ai_conversations
for insert
to authenticated
with check (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
);

drop policy if exists "ai_conversations_update_owner_agency_master" on public.ai_conversations;
create policy "ai_conversations_update_owner_agency_master"
on public.ai_conversations
for update
to authenticated
using (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
)
with check (
  public.is_master_user()
  or owner_user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
);

drop policy if exists "ai_messages_select_via_conversation" on public.ai_messages;
create policy "ai_messages_select_via_conversation"
on public.ai_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_conversations conversation
    where conversation.id = ai_messages.conversation_id
      and (
        public.is_master_user()
        or conversation.owner_user_id = auth.uid()
        or (
          conversation.agency_id is not null
          and (public.is_agency_owner(conversation.agency_id) or public.is_agency_member(conversation.agency_id))
        )
      )
  )
);

drop policy if exists "ai_messages_insert_via_conversation" on public.ai_messages;
create policy "ai_messages_insert_via_conversation"
on public.ai_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ai_conversations conversation
    where conversation.id = ai_messages.conversation_id
      and (
        public.is_master_user()
        or conversation.owner_user_id = auth.uid()
        or (
          conversation.agency_id is not null
          and (public.is_agency_owner(conversation.agency_id) or public.is_agency_member(conversation.agency_id))
        )
      )
  )
);

-- Importante:
-- O link publico/admin sem sessao NAO recebe policy anonima aqui.
-- Para salvar historico sem sessao de forma segura, a abordagem correta futura
-- e uma camada backend/token curto validado, nunca using (true).
