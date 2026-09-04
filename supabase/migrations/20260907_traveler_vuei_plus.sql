-- Vuei+ is deliberately stored beside, not inside, the legacy traveler plan. Version follows trip-link expiration.
-- This keeps Premium plan credits and its Stripe subscription untouched.
alter table public.traveler_subscriptions
  add column if not exists vuei_plus_status text not null default 'none',
  add column if not exists vuei_plus_stripe_subscription_id text,
  add column if not exists vuei_plus_stripe_price_id text,
  add column if not exists vuei_plus_current_period_start timestamptz,
  add column if not exists vuei_plus_current_period_end timestamptz,
  add column if not exists vuei_plus_cancel_at_period_end boolean not null default false;

alter table public.traveler_subscriptions
  drop constraint if exists traveler_subscriptions_vuei_plus_status_check;

alter table public.traveler_subscriptions
  add constraint traveler_subscriptions_vuei_plus_status_check check (
    vuei_plus_status in ('none', 'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')
  );

create unique index if not exists idx_traveler_subscriptions_vuei_plus_subscription_id
  on public.traveler_subscriptions (vuei_plus_stripe_subscription_id)
  where vuei_plus_stripe_subscription_id is not null;

comment on column public.traveler_subscriptions.plan_code is
  'Legacy traveler AI plan only (free/premium). Vuei+ must not be written here.';
comment on column public.traveler_subscriptions.vuei_plus_status is
  'Independent Vuei+ membership status. Does not grant trip_link or AI credits.';

create or replace function public.traveler_has_archive_entitlement(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.traveler_subscriptions subscription
    where subscription.user_id = p_user_id
      and (p_user_id = auth.uid() or auth.role() = 'service_role')
      and (
        (
          subscription.plan_code = 'premium'
          and (
            (
              subscription.status in ('active', 'trialing')
              and (subscription.current_period_end is null or subscription.current_period_end >= p_at)
            )
            or (
              subscription.status = 'canceled'
              and subscription.current_period_end is not null
              and subscription.current_period_end >= p_at
            )
          )
        )
        or (
          (
            subscription.vuei_plus_status in ('active', 'trialing')
            and (
              subscription.vuei_plus_current_period_end is null
              or subscription.vuei_plus_current_period_end >= p_at
            )
          )
          or (
            subscription.vuei_plus_status = 'canceled'
            and subscription.vuei_plus_current_period_end is not null
            and subscription.vuei_plus_current_period_end >= p_at
          )
        )
      )
  );
$$;

create or replace function public.traveler_can_access_trip_content(
  p_trip_id uuid,
  p_user_id uuid default auth.uid(),
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips trip
    where trip.id = p_trip_id
      and trip.owner_type = 'traveler'
      and trip.owner_user_id = p_user_id
      and (p_user_id = auth.uid() or auth.role() = 'service_role')
      and (
        (
          trip.status <> 'cancelled'
          and (
            trip.link_activated_at is null
            or (
              trip.link_access_until is not null
              and p_at <= trip.link_access_until
            )
          )
        )
        or public.traveler_has_archive_entitlement(p_user_id, p_at)
      )
  );
$$;

create or replace function public.traveler_can_read_document_storage_object(
  p_name text,
  p_user_id uuid default auth.uid(),
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    array_length(storage.foldername(p_name), 1) >= 2
    and (storage.foldername(p_name))[1] = p_user_id::text
    and (
      not exists (
        select 1
        from public.trips trip
        where trip.id::text = (storage.foldername(p_name))[2]
          and trip.owner_type = 'traveler'
          and trip.owner_user_id = p_user_id
      )
      or exists (
        select 1
        from public.trips trip
        where trip.id::text = (storage.foldername(p_name))[2]
          and public.traveler_can_access_trip_content(trip.id, p_user_id, p_at)
      )
    );
$$;

-- Metadata remains visible on trips so the portal can render a locked archive.
-- Sensitive/content tables require the centralized archive entitlement.
drop policy if exists "documents_select_owner_agency_or_master" on public.documents;
create policy "documents_select_owner_agency_or_master"
on public.documents
for select
to authenticated
using (
  public.is_master_user()
  or (
    owner_user_id = auth.uid()
    and public.traveler_can_access_trip_content(documents.trip_id, auth.uid())
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
  or (
    visibility = 'public_trip'
    and is_private = false
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and public.is_trip_publicly_accessible(
          trip.owner_type,
          trip.visibility,
          trip.status,
          trip.link_activated_at,
          trip.link_access_until
        )
    )
  )
);

drop policy if exists "trip_flights_select_owner_agency_or_master" on public.trip_flights;
create policy "trip_flights_select_owner_agency_or_master"
on public.trip_flights
for select
to authenticated
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips trip
    where trip.id = trip_flights.trip_id
      and (
        (trip.owner_type = 'traveler' and public.traveler_can_access_trip_content(trip.id, auth.uid()))
        or (
          trip.agency_id is not null
          and (public.is_agency_member(trip.agency_id) or public.is_agency_owner(trip.agency_id))
        )
        or public.is_trip_publicly_accessible(
          trip.owner_type,
          trip.visibility,
          trip.status,
          trip.link_activated_at,
          trip.link_access_until
        )
      )
  )
);

drop policy if exists "trip_hotels_select_owner" on public.trip_hotels;
create policy "trip_hotels_select_owner"
on public.trip_hotels
for select
to authenticated
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips trip
    where trip.id = trip_hotels.trip_id
      and (
        (trip.owner_type = 'traveler' and public.traveler_can_access_trip_content(trip.id, auth.uid()))
        or (
          trip.agency_id is not null
          and (public.is_agency_member(trip.agency_id) or public.is_agency_owner(trip.agency_id))
        )
      )
  )
);

drop policy if exists "trip_itineraries_select" on public.trip_itineraries;
create policy "trip_itineraries_select"
on public.trip_itineraries
for select
to authenticated
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips trip
    where trip.id = trip_itineraries.trip_id
      and (
        (trip.owner_type = 'traveler' and public.traveler_can_access_trip_content(trip.id, auth.uid()))
        or (
          trip.agency_id is not null
          and (public.is_agency_member(trip.agency_id) or public.is_agency_owner(trip.agency_id))
        )
        or public.is_trip_publicly_accessible(
          trip.owner_type,
          trip.visibility,
          trip.status,
          trip.link_activated_at,
          trip.link_access_until
        )
      )
  )
);

drop policy if exists "trip_travelers_select_owner_agency_or_master" on public.trip_travelers;
create policy "trip_travelers_select_owner_agency_or_master"
on public.trip_travelers
for select
to authenticated
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips trip
    where trip.id = trip_travelers.trip_id
      and (
        (trip.owner_type = 'traveler' and public.traveler_can_access_trip_content(trip.id, auth.uid()))
        or (
          trip.owner_type = 'agency'
          and (public.is_agency_member(trip.agency_id) or public.is_agency_owner(trip.agency_id))
        )
      )
  )
);

drop policy if exists "ai_conversations_select_owner_agency_or_master" on public.ai_conversations;
drop policy if exists "ai_conversations_select_owner" on public.ai_conversations;
drop policy if exists "ai_conversations_select_master" on public.ai_conversations;
drop policy if exists "ai_conversations_select_agency" on public.ai_conversations;
drop policy if exists "ai_conversations_select_access" on public.ai_conversations;
create policy "ai_conversations_select_access"
on public.ai_conversations
for select
to authenticated
using (
  public.is_master_user()
  or (
    owner_user_id = auth.uid()
    and (
      trip_id is null
      or public.traveler_can_access_trip_content(trip_id, auth.uid())
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_owner(agency_id) or public.is_agency_member(agency_id))
  )
);

drop policy if exists "ai_messages_select_owner_agency_or_master" on public.ai_messages;
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
        or (
          conversation.owner_user_id = auth.uid()
          and (
            conversation.trip_id is null
            or public.traveler_can_access_trip_content(conversation.trip_id, auth.uid())
          )
        )
        or (
          conversation.agency_id is not null
          and (public.is_agency_owner(conversation.agency_id) or public.is_agency_member(conversation.agency_id))
        )
      )
  )
);

drop policy if exists "documents bucket select own files" on storage.objects;
create policy "documents bucket select own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vuei-documents'
  and public.traveler_can_read_document_storage_object(name, auth.uid())
);

revoke all on function public.traveler_has_archive_entitlement(uuid, timestamptz) from public, anon;
revoke all on function public.traveler_can_access_trip_content(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.traveler_can_read_document_storage_object(text, uuid, timestamptz) from public, anon;
grant execute on function public.traveler_has_archive_entitlement(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.traveler_can_access_trip_content(uuid, uuid, timestamptz) to authenticated, service_role;
grant execute on function public.traveler_can_read_document_storage_object(text, uuid, timestamptz) to authenticated, service_role;
