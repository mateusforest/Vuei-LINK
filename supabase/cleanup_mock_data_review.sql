-- Vuei mock/test data review
-- Nao execute em bloco sem revisar cada secao.
-- Este arquivo prioriza diagnostico e revisao manual.
-- Nenhum DELETE abaixo deve ser executado sem validar os resultados do SELECT imediatamente acima.

-- =========================================================
-- 1. PERFIS
-- =========================================================

-- Perfis com role de agencia sem agency_id preenchido.
select id, email, role, agency_id, created_at, updated_at
from public.profiles
where role in ('agency_owner', 'agency_member')
  and agency_id is null
order by created_at desc;

-- Perfis com dados suspeitos de seed/demo.
select id, email, name, role, created_at
from public.profiles
where lower(coalesce(email, '')) like '%demo%'
   or lower(coalesce(email, '')) like '%teste%'
   or lower(coalesce(email, '')) like '%mock%'
   or lower(coalesce(name, '')) like '%demo%'
   or lower(coalesce(name, '')) like '%teste%'
   or lower(coalesce(name, '')) like '%mock%'
order by created_at desc;

-- Revisar manualmente antes de executar qualquer limpeza.
-- delete from public.profiles
-- where id in (...ids confirmados como teste...);

-- =========================================================
-- 2. AGENCIAS
-- =========================================================

-- Agencias sem owner vinculado.
select id, name, slug, owner_user_id, created_at, updated_at
from public.agencies
where owner_user_id is null
order by created_at desc;

-- Agencias sem membership owner correspondente.
select a.id, a.name, a.owner_user_id
from public.agencies a
left join public.agency_members m
  on m.agency_id = a.id
 and m.profile_id = a.owner_user_id
 and m.role = 'owner'
where a.owner_user_id is not null
  and m.id is null
order by a.created_at desc;

-- Agencias com dados suspeitos de seed/demo.
select id, name, slug, owner_user_id, created_at
from public.agencies
where lower(coalesce(name, '')) like '%demo%'
   or lower(coalesce(name, '')) like '%teste%'
   or lower(coalesce(name, '')) like '%mock%'
order by created_at desc;

-- delete from public.agencies
-- where id in (...ids confirmados como teste...);

-- =========================================================
-- 3. AGENCY_MEMBERS
-- =========================================================

-- Memberships sem agencia valida.
select m.id, m.agency_id, m.profile_id, m.role, m.status, m.created_at
from public.agency_members m
left join public.agencies a on a.id = m.agency_id
where a.id is null
order by m.created_at desc;

-- Memberships sem profile valido.
select m.id, m.agency_id, m.profile_id, m.role, m.status, m.created_at
from public.agency_members m
left join public.profiles p on p.id = m.profile_id
where p.id is null
order by m.created_at desc;

-- delete from public.agency_members
-- where id in (...ids confirmados como orfaos...);

-- =========================================================
-- 4. CLIENTS
-- =========================================================

-- Clientes sem agency_id.
select id, agency_id, name, email, status, created_at
from public.clients
where agency_id is null
order by created_at desc;

-- Clientes com agencia inexistente.
select c.id, c.name, c.agency_id, c.created_at
from public.clients c
left join public.agencies a on a.id = c.agency_id
where c.agency_id is not null
  and a.id is null
order by c.created_at desc;

-- Clientes suspeitos de seed/demo.
select id, name, email, agency_id, created_at
from public.clients
where lower(coalesce(name, '')) like '%demo%'
   or lower(coalesce(name, '')) like '%teste%'
   or lower(coalesce(name, '')) like '%mock%'
   or lower(coalesce(email, '')) like '%demo%'
   or lower(coalesce(email, '')) like '%teste%'
   or lower(coalesce(email, '')) like '%mock%'
order by created_at desc;

-- update public.clients
-- set status = 'inactive'
-- where id in (...ids confirmados para desativacao...);

-- =========================================================
-- 5. TRIPS
-- =========================================================

-- Viagens de traveler sem owner_user_id.
select id, title, slug, owner_type, owner_user_id, agency_id, client_id, created_at
from public.trips
where owner_type = 'traveler'
  and owner_user_id is null
order by created_at desc;

-- Viagens de agencia sem agency_id.
select id, title, slug, owner_type, owner_user_id, agency_id, client_id, created_at
from public.trips
where owner_type = 'agency'
  and agency_id is null
order by created_at desc;

-- Viagens com client_id sem cliente existente.
select t.id, t.title, t.client_id, t.agency_id, t.created_at
from public.trips t
left join public.clients c on c.id = t.client_id
where t.client_id is not null
  and c.id is null
order by t.created_at desc;

-- Viagens com agency_id sem agencia existente.
select t.id, t.title, t.agency_id, t.created_at
from public.trips t
left join public.agencies a on a.id = t.agency_id
where t.agency_id is not null
  and a.id is null
order by t.created_at desc;

-- Viagens suspeitas de seed/demo.
select id, title, slug, destination, owner_type, created_at
from public.trips
where lower(coalesce(title, '')) like '%demo%'
   or lower(coalesce(title, '')) like '%teste%'
   or lower(coalesce(title, '')) like '%mock%'
   or lower(coalesce(destination, '')) like '%demo%'
   or lower(coalesce(destination, '')) like '%teste%'
order by created_at desc;

-- delete from public.trips
-- where id in (...ids confirmados como teste...);

-- =========================================================
-- 6. DOCUMENTS
-- =========================================================

-- Documentos sem qualquer vinculo operacional.
select id, name, type, trip_id, client_id, agency_id, owner_user_id, created_at
from public.documents
where trip_id is null
  and client_id is null
  and agency_id is null
order by created_at desc;

-- Documentos de agencia sem trip real.
select d.id, d.name, d.agency_id, d.trip_id, d.created_at
from public.documents d
left join public.trips t on t.id = d.trip_id
where d.agency_id is not null
  and d.trip_id is not null
  and t.id is null
order by d.created_at desc;

-- Documentos suspeitos de seed/demo.
select id, name, type, trip_id, agency_id, client_id, created_at
from public.documents
where lower(coalesce(name, '')) like '%demo%'
   or lower(coalesce(name, '')) like '%teste%'
   or lower(coalesce(name, '')) like '%mock%'
order by created_at desc;

-- delete from public.documents
-- where id in (...ids confirmados como teste...);

-- =========================================================
-- 7. TRIP_HOTELS
-- =========================================================

-- Hospedagens sem trip valida.
select h.id, h.trip_id, h.name, h.created_at
from public.trip_hotels h
left join public.trips t on t.id = h.trip_id
where t.id is null
order by h.created_at desc;

-- Hospedagens suspeitas de seed/demo.
select id, trip_id, name, address, created_at
from public.trip_hotels
where lower(coalesce(name, '')) like '%demo%'
   or lower(coalesce(name, '')) like '%teste%'
   or lower(coalesce(name, '')) like '%mock%'
order by created_at desc;

-- delete from public.trip_hotels
-- where id in (...ids confirmados como teste...);

-- =========================================================
-- 8. REVISOES DE CONSISTENCIA ENTRE TABELAS
-- =========================================================

-- Agency owners sem agencia vinculada no profile, mas com agencia existente.
select p.id as profile_id, p.email, p.agency_id as profile_agency_id, a.id as actual_agency_id, a.name
from public.profiles p
join public.agencies a on a.owner_user_id = p.id
where p.role = 'agency_owner'
  and (p.agency_id is null or p.agency_id <> a.id)
order by a.created_at desc;

-- Possivel correcao manual, revisar resultado antes de executar.
-- update public.profiles p
-- set agency_id = a.id
-- from public.agencies a
-- where p.id = a.owner_user_id
--   and p.role = 'agency_owner'
--   and (p.agency_id is null or p.agency_id <> a.id);

-- Trips de agencia sem membership owner ativo correspondente.
select t.id, t.title, t.agency_id, a.owner_user_id
from public.trips t
join public.agencies a on a.id = t.agency_id
left join public.agency_members m
  on m.agency_id = a.id
 and m.profile_id = a.owner_user_id
 and m.role = 'owner'
 and m.status = 'active'
where t.owner_type = 'agency'
  and m.id is null
order by t.created_at desc;

-- =========================================================
-- 9. CONTAGENS RAPIDAS DE REVISAO
-- =========================================================

select 'profiles' as table_name, count(*) as total from public.profiles
union all
select 'agencies', count(*) from public.agencies
union all
select 'agency_members', count(*) from public.agency_members
union all
select 'clients', count(*) from public.clients
union all
select 'trips', count(*) from public.trips
union all
select 'documents', count(*) from public.documents
union all
select 'trip_hotels', count(*) from public.trip_hotels;
