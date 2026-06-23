create table if not exists public.trip_travelers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  role text not null default 'companion',
  is_primary boolean not null default false,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_travelers_role_check check (role in ('primary', 'companion'))
);

create index if not exists trip_travelers_trip_id_idx
  on public.trip_travelers(trip_id);

create unique index if not exists trip_travelers_one_primary_per_trip_idx
  on public.trip_travelers(trip_id)
  where is_primary = true;

create or replace function public.normalize_trip_travelers_primary()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'primary' then
    new.is_primary = true;
  end if;

  if new.is_primary then
    new.role = 'primary';
    update public.trip_travelers
      set is_primary = false,
          role = 'companion',
          updated_at = now()
    where trip_id = new.trip_id
      and id <> new.id
      and is_primary = true;
  elsif tg_op = 'insert'
    and not exists (
      select 1
      from public.trip_travelers
      where trip_id = new.trip_id
        and is_primary = true
    ) then
    new.is_primary = true;
    new.role = 'primary';
  elsif new.role = 'primary' then
    new.role = 'companion';
  end if;

  return new;
end;
$$;

create or replace function public.sync_trip_travelers_count()
returns trigger
language plpgsql
as $$
declare
  target_trip_id uuid;
begin
  target_trip_id := case when tg_op = 'delete' then old.trip_id else new.trip_id end;

  update public.trips
    set travelers_count = (
      select count(*)
      from public.trip_travelers
      where trip_id = target_trip_id
    ),
    updated_at = now()
  where id = target_trip_id;

  if not exists (
    select 1
    from public.trip_travelers
    where trip_id = target_trip_id
      and is_primary = true
  ) then
    update public.trip_travelers
      set is_primary = true,
          role = 'primary',
          updated_at = now()
    where id = (
      select id
      from public.trip_travelers
      where trip_id = target_trip_id
      order by created_at asc, id asc
      limit 1
    );
  end if;

  if tg_op = 'update' and old.trip_id is distinct from new.trip_id then
    update public.trips
      set travelers_count = (
        select count(*)
        from public.trip_travelers
        where trip_id = old.trip_id
      ),
      updated_at = now()
    where id = old.trip_id;

    if not exists (
      select 1
      from public.trip_travelers
      where trip_id = old.trip_id
        and is_primary = true
    ) then
      update public.trip_travelers
        set is_primary = true,
            role = 'primary',
            updated_at = now()
      where id = (
        select id
        from public.trip_travelers
        where trip_id = old.trip_id
        order by created_at asc, id asc
        limit 1
      );
    end if;
  end if;

  return case when tg_op = 'delete' then old else new end;
end;
$$;

alter table public.trip_travelers enable row level security;

drop trigger if exists set_trip_travelers_updated_at on public.trip_travelers;
create trigger set_trip_travelers_updated_at
before update on public.trip_travelers
for each row
execute function public.set_updated_at();

drop trigger if exists normalize_trip_travelers_primary_trigger on public.trip_travelers;
create trigger normalize_trip_travelers_primary_trigger
before insert or update on public.trip_travelers
for each row
execute function public.normalize_trip_travelers_primary();

drop trigger if exists sync_trip_travelers_count_trigger on public.trip_travelers;
create trigger sync_trip_travelers_count_trigger
after insert or update or delete on public.trip_travelers
for each row
execute function public.sync_trip_travelers_count();

drop policy if exists "trip_travelers_select_owner_agency_or_master" on public.trip_travelers;
create policy "trip_travelers_select_owner_agency_or_master"
on public.trip_travelers
for select
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips
    where trips.id = trip_travelers.trip_id
      and (
        (trips.owner_type = 'traveler' and trips.owner_user_id = auth.uid())
        or (
          trips.owner_type = 'agency'
          and (
            public.is_agency_member(trips.agency_id)
            or public.is_agency_owner(trips.agency_id)
          )
        )
      )
  )
);

drop policy if exists "trip_travelers_insert_owner_agency_or_master" on public.trip_travelers;
create policy "trip_travelers_insert_owner_agency_or_master"
on public.trip_travelers
for insert
with check (
  public.is_master_user()
  or exists (
    select 1
    from public.trips
    where trips.id = trip_travelers.trip_id
      and (
        (trips.owner_type = 'traveler' and trips.owner_user_id = auth.uid())
        or (
          trips.owner_type = 'agency'
          and (
            public.is_agency_member(trips.agency_id)
            or public.is_agency_owner(trips.agency_id)
          )
        )
      )
  )
);

drop policy if exists "trip_travelers_update_owner_agency_or_master" on public.trip_travelers;
create policy "trip_travelers_update_owner_agency_or_master"
on public.trip_travelers
for update
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips
    where trips.id = trip_travelers.trip_id
      and (
        (trips.owner_type = 'traveler' and trips.owner_user_id = auth.uid())
        or (
          trips.owner_type = 'agency'
          and (
            public.is_agency_member(trips.agency_id)
            or public.is_agency_owner(trips.agency_id)
          )
        )
      )
  )
)
with check (
  public.is_master_user()
  or exists (
    select 1
    from public.trips
    where trips.id = trip_travelers.trip_id
      and (
        (trips.owner_type = 'traveler' and trips.owner_user_id = auth.uid())
        or (
          trips.owner_type = 'agency'
          and (
            public.is_agency_member(trips.agency_id)
            or public.is_agency_owner(trips.agency_id)
          )
        )
      )
  )
);

drop policy if exists "trip_travelers_delete_owner_agency_or_master" on public.trip_travelers;
create policy "trip_travelers_delete_owner_agency_or_master"
on public.trip_travelers
for delete
using (
  public.is_master_user()
  or exists (
    select 1
    from public.trips
    where trips.id = trip_travelers.trip_id
      and (
        (trips.owner_type = 'traveler' and trips.owner_user_id = auth.uid())
        or (
          trips.owner_type = 'agency'
          and (
            public.is_agency_member(trips.agency_id)
            or public.is_agency_owner(trips.agency_id)
          )
        )
      )
  )
);
