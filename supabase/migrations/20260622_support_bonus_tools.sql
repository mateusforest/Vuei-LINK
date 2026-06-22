create extension if not exists pgcrypto;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  agency_id uuid null references public.agencies(id) on delete set null,
  title text not null,
  category text not null default 'other',
  priority text not null default 'normal',
  status text not null default 'open',
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_category_check check (category in ('vuei_help', 'technical_issue', 'billing', 'credits', 'trip_link', 'other')),
  constraint support_tickets_priority_check check (priority in ('normal', 'urgent')),
  constraint support_tickets_status_check check (status in ('open', 'in_progress', 'resolved'))
);

alter table public.support_tickets alter column user_id drop not null;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid null references public.profiles(id) on delete set null,
  sender_role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_sender_role_check check (sender_role in ('traveler', 'agency', 'master', 'system'))
);

create table if not exists public.account_limit_overrides (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  limit_type text not null,
  quantity integer not null check (quantity > 0),
  reason text null,
  ticket_id uuid null references public.support_tickets(id) on delete set null,
  granted_by uuid null references public.profiles(id) on delete set null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint account_limit_overrides_owner_type_check check (owner_type in ('agency', 'traveler')),
  constraint account_limit_overrides_limit_type_check check (limit_type in ('clients', 'active_trips'))
);

create index if not exists idx_support_tickets_user_id on public.support_tickets (user_id);
create index if not exists idx_support_tickets_agency_id on public.support_tickets (agency_id);
create index if not exists idx_support_tickets_status on public.support_tickets (status);
create index if not exists idx_support_tickets_priority on public.support_tickets (priority);
create index if not exists idx_support_tickets_created_at on public.support_tickets (created_at desc);
create index if not exists idx_support_messages_ticket_id on public.support_messages (ticket_id, created_at asc);
create index if not exists idx_account_limit_overrides_owner on public.account_limit_overrides (owner_type, owner_id, limit_type);
create index if not exists idx_account_limit_overrides_expires_at on public.account_limit_overrides (expires_at);

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.account_limit_overrides enable row level security;

drop policy if exists "support_tickets_select_owner_or_master" on public.support_tickets;
create policy "support_tickets_select_owner_or_master"
on public.support_tickets
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  )
);

drop policy if exists "support_tickets_insert_owner" on public.support_tickets;
create policy "support_tickets_insert_owner"
on public.support_tickets
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists "support_tickets_update_master" on public.support_tickets;
create policy "support_tickets_update_master"
on public.support_tickets
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  )
)
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  )
);

drop policy if exists "support_messages_select_ticket_owner_or_master" on public.support_messages;
create policy "support_messages_select_ticket_owner_or_master"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets ticket
    where ticket.id = support_messages.ticket_id
      and (
        ticket.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles profile
          where profile.id = auth.uid()
            and profile.role = 'master'
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
  exists (
    select 1
    from public.support_tickets ticket
    where ticket.id = support_messages.ticket_id
      and (
        ticket.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles profile
          where profile.id = auth.uid()
            and profile.role = 'master'
        )
      )
  )
);

drop policy if exists "account_limit_overrides_select_owner_or_master" on public.account_limit_overrides;
create policy "account_limit_overrides_select_owner_or_master"
on public.account_limit_overrides
for select
to authenticated
using (
  (
    owner_type = 'traveler'
    and owner_id = auth.uid()
  )
  or (
    owner_type = 'agency'
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.agency_id = account_limit_overrides.owner_id
    )
  )
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  )
);

drop policy if exists "account_limit_overrides_master_insert" on public.account_limit_overrides;
create policy "account_limit_overrides_master_insert"
on public.account_limit_overrides
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  )
);

drop policy if exists "account_limit_overrides_master_update" on public.account_limit_overrides;
create policy "account_limit_overrides_master_update"
on public.account_limit_overrides
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  )
)
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'master'
  )
);
