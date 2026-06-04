-- Vuei credits ledger setup
-- Nao executar automaticamente. Revisar no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_user_id uuid null references public.profiles(id) on delete set null,
  agency_id uuid null references public.agencies(id) on delete set null,
  type text not null,
  amount integer not null,
  balance_after integer null,
  reason text null,
  source text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null,
  constraint credit_transactions_owner_type_check check (owner_type in ('traveler', 'agency')),
  constraint credit_transactions_type_check check (type in ('grant', 'consume', 'refund', 'adjustment', 'purchase')),
  constraint credit_transactions_amount_non_zero check (amount <> 0),
  constraint credit_transactions_owner_target_check check (
    (owner_type = 'traveler' and owner_user_id is not null)
    or (owner_type = 'agency' and agency_id is not null)
  )
);

create index if not exists idx_credit_transactions_owner_user_id
  on public.credit_transactions (owner_user_id);

create index if not exists idx_credit_transactions_agency_id
  on public.credit_transactions (agency_id);

create index if not exists idx_credit_transactions_created_at
  on public.credit_transactions (created_at desc);

create or replace function public.apply_credit_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if new.owner_type = 'traveler' then
    select credits_balance
      into current_balance
    from public.profiles
    where id = new.owner_user_id
    for update;

    if current_balance is null then
      raise exception 'Profile de creditos nao encontrado para owner_user_id=%', new.owner_user_id;
    end if;
  elsif new.owner_type = 'agency' then
    select credits_balance
      into current_balance
    from public.agencies
    where id = new.agency_id
    for update;

    if current_balance is null then
      raise exception 'Agencia de creditos nao encontrada para agency_id=%', new.agency_id;
    end if;
  else
    raise exception 'owner_type invalido: %', new.owner_type;
  end if;

  new.balance_after := coalesce(new.balance_after, current_balance + new.amount);

  if new.balance_after < 0 then
    raise exception 'Saldo de creditos insuficiente para esta operacao.';
  end if;

  if new.owner_type = 'traveler' then
    update public.profiles
    set credits_balance = new.balance_after,
        updated_at = now()
    where id = new.owner_user_id;
  else
    update public.agencies
    set credits_balance = new.balance_after,
        updated_at = now()
    where id = new.agency_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_credit_transaction_balance on public.credit_transactions;
create trigger apply_credit_transaction_balance
before insert on public.credit_transactions
for each row
execute function public.apply_credit_transaction_balance();

alter table public.credit_transactions enable row level security;

drop policy if exists "credit_transactions_select_master" on public.credit_transactions;
create policy "credit_transactions_select_master"
on public.credit_transactions
for select
to authenticated
using (public.is_master_user());

drop policy if exists "credit_transactions_select_traveler" on public.credit_transactions;
create policy "credit_transactions_select_traveler"
on public.credit_transactions
for select
to authenticated
using (
  owner_type = 'traveler'
  and owner_user_id = auth.uid()
);

drop policy if exists "credit_transactions_select_agency" on public.credit_transactions;
create policy "credit_transactions_select_agency"
on public.credit_transactions
for select
to authenticated
using (
  owner_type = 'agency'
  and agency_id is not null
  and (
    public.is_agency_owner(agency_id)
    or public.is_agency_member(agency_id)
  )
);

drop policy if exists "credit_transactions_insert_master" on public.credit_transactions;
create policy "credit_transactions_insert_master"
on public.credit_transactions
for insert
to authenticated
with check (
  public.is_master_user()
);

drop policy if exists "credit_transactions_insert_traveler_consume" on public.credit_transactions;
create policy "credit_transactions_insert_traveler_consume"
on public.credit_transactions
for insert
to authenticated
with check (
  owner_type = 'traveler'
  and owner_user_id = auth.uid()
  and type = 'consume'
  and amount < 0
);

drop policy if exists "credit_transactions_insert_agency_consume" on public.credit_transactions;
create policy "credit_transactions_insert_agency_consume"
on public.credit_transactions
for insert
to authenticated
with check (
  owner_type = 'agency'
  and agency_id is not null
  and type = 'consume'
  and amount < 0
  and (
    public.is_agency_owner(agency_id)
    or public.is_agency_member(agency_id)
  )
);

-- Nao ha policies de update/delete nesta fase.
-- O ledger deve ser imutavel; ajustes devem entrar como novas transacoes.
