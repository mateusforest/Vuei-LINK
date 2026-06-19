-- Vuei support center
-- Review manually before running in Supabase SQL Editor.
-- Creates support tickets and threaded support messages without destructive changes.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  agency_id uuid null references public.agencies(id) on delete set null,
  title text not null,
  category text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_category_check check (
    category in ('vuei_help', 'technical_issue', 'billing', 'credits', 'trip_link', 'other')
  ),
  constraint support_tickets_priority_check check (priority in ('normal', 'urgent')),
  constraint support_tickets_status_check check (status in ('open', 'in_progress', 'resolved'))
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid null references public.profiles(id) on delete set null,
  sender_role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_sender_role_check check (sender_role in ('traveler', 'agency', 'master', 'system'))
);

create index if not exists idx_support_tickets_user_id on public.support_tickets (user_id);
create index if not exists idx_support_tickets_agency_id on public.support_tickets (agency_id);
create index if not exists idx_support_tickets_status on public.support_tickets (status);
create index if not exists idx_support_tickets_priority on public.support_tickets (priority);
create index if not exists idx_support_tickets_created_at on public.support_tickets (created_at desc);
create index if not exists idx_support_messages_ticket_id on public.support_messages (ticket_id, created_at asc);

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support_tickets_select_owner_or_master" on public.support_tickets;
create policy "support_tickets_select_owner_or_master"
on public.support_tickets
for select
to authenticated
using (
  public.is_master_user()
  or user_id = auth.uid()
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "support_tickets_insert_owner" on public.support_tickets;
create policy "support_tickets_insert_owner"
on public.support_tickets
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    agency_id is null
    or public.is_agency_member(agency_id)
    or public.is_agency_owner(agency_id)
  )
);

drop policy if exists "support_tickets_update_master" on public.support_tickets;
create policy "support_tickets_update_master"
on public.support_tickets
for update
to authenticated
using (public.is_master_user())
with check (public.is_master_user());

drop policy if exists "support_messages_select_ticket_owner_or_master" on public.support_messages;
create policy "support_messages_select_ticket_owner_or_master"
on public.support_messages
for select
to authenticated
using (
  public.is_master_user()
  or exists (
    select 1
    from public.support_tickets ticket
    where ticket.id = support_messages.ticket_id
      and (
        ticket.user_id = auth.uid()
        or (
          ticket.agency_id is not null
          and (public.is_agency_member(ticket.agency_id) or public.is_agency_owner(ticket.agency_id))
        )
      )
  )
);

drop policy if exists "support_messages_insert_ticket_owner_or_master" on public.support_messages;
create policy "support_messages_insert_ticket_owner_or_master"
on public.support_messages
for insert
to authenticated
with check (
  public.is_master_user()
  or (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.support_tickets ticket
      where ticket.id = support_messages.ticket_id
        and ticket.user_id = auth.uid()
    )
  )
);
