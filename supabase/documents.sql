create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  type text not null,
  file_url text,
  file_path text,
  mime_type text,
  size_bytes bigint,
  is_private boolean not null default true,
  visibility text not null default 'private',
  ai_extracted_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_visibility_check check (visibility in ('private', 'public_trip', 'agency_only')),
  constraint documents_size_bytes_check check (size_bytes is null or size_bytes >= 0)
);

create index if not exists idx_documents_trip_id on public.documents (trip_id);
create index if not exists idx_documents_client_id on public.documents (client_id);
create index if not exists idx_documents_agency_id on public.documents (agency_id);
create index if not exists idx_documents_owner_user_id on public.documents (owner_user_id);
create index if not exists idx_documents_visibility on public.documents (visibility);
create index if not exists idx_documents_is_private on public.documents (is_private);

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists "documents_select_owner_agency_or_master" on public.documents;
create policy "documents_select_owner_agency_or_master"
on public.documents
for select
using (
  public.is_master_user()
  or (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "documents_insert_owner_or_agency" on public.documents;
create policy "documents_insert_owner_or_agency"
on public.documents
for insert
with check (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.agency_id = documents.agency_id
        and (public.is_agency_member(documents.agency_id) or public.is_agency_owner(documents.agency_id))
    )
  )
);

drop policy if exists "documents_update_owner_or_agency" on public.documents;
create policy "documents_update_owner_or_agency"
on public.documents
for update
using (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
)
with check (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

drop policy if exists "documents_delete_owner_or_agency" on public.documents;
create policy "documents_delete_owner_or_agency"
on public.documents
for delete
using (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.trips trip
      where trip.id = documents.trip_id
        and trip.owner_user_id = auth.uid()
    )
  )
  or (
    agency_id is not null
    and (public.is_agency_member(agency_id) or public.is_agency_owner(agency_id))
  )
);

comment on table public.documents is 'Acesso publico do link da viagem deve ser tratado em endpoint controlado ou consulta por token, nunca por policy generica nesta fase.';

-- Bucket sugerido para fase futura de storage:
-- insert into storage.buckets (id, name, public)
-- values ('vuei-documents', 'vuei-documents', false)
-- on conflict (id) do nothing;
--
-- Regras planejadas:
-- 1. bucket privado por padrao;
-- 2. documentos privados nunca publicos;
-- 3. acesso por signed URL no futuro;
-- 4. link publico so deve acessar documentos com visibility = 'public_trip';
-- 5. arquivos de agencia devem respeitar agency_id;
-- 6. arquivos de usuario devem respeitar owner_user_id.
