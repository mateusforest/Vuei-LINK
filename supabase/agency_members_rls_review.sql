-- Vuei agency_members RLS review
-- Nao executar automaticamente.
-- Use este arquivo para revisar se o ambiente real possui as policies
-- necessarias para leitura e gestao da equipe da agencia.

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('agency_members', 'profiles', 'agencies')
order by tablename, policyname;

-- Policies recomendadas caso o ambiente ativo ainda nao esteja alinhado:

alter table public.agency_members enable row level security;

drop policy if exists "agency_members_select_same_agency_or_master" on public.agency_members;
create policy "agency_members_select_same_agency_or_master"
on public.agency_members
for select
using (
  public.is_master_user()
  or profile_id = auth.uid()
  or public.is_agency_member(agency_id)
  or public.is_agency_owner(agency_id)
);

drop policy if exists "agency_members_insert_owner_or_master" on public.agency_members;
create policy "agency_members_insert_owner_or_master"
on public.agency_members
for insert
with check (
  public.is_master_user()
  or public.is_agency_owner(agency_id)
);

drop policy if exists "agency_members_update_owner_or_master" on public.agency_members;
create policy "agency_members_update_owner_or_master"
on public.agency_members
for update
using (
  public.is_master_user()
  or public.is_agency_owner(agency_id)
)
with check (
  public.is_master_user()
  or public.is_agency_owner(agency_id)
);

-- Observacao:
-- nesta fase o fluxo de "remover" membro foi implementado como status = 'inactive',
-- portanto nao depende de policy delete.
