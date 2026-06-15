-- Master credits extension for clients
-- Executar manualmente no Supabase SQL Editor antes de liberar creditos para clientes.

alter table public.clients
  add column if not exists credits_balance integer not null default 0;

alter table public.credit_transactions
  add column if not exists client_id uuid references public.clients(id) on delete set null;

do $$
begin
  alter table public.credit_transactions drop constraint if exists credit_transactions_owner_type_check;
  alter table public.credit_transactions
    add constraint credit_transactions_owner_type_check
    check (owner_type in ('traveler', 'agency', 'client'));

  alter table public.credit_transactions drop constraint if exists credit_transactions_owner_target_check;
  alter table public.credit_transactions
    add constraint credit_transactions_owner_target_check
    check (
      (owner_type = 'traveler' and owner_user_id is not null and agency_id is null and client_id is null)
      or (owner_type = 'agency' and agency_id is not null and owner_user_id is null and client_id is null)
      or (owner_type = 'client' and client_id is not null and owner_user_id is null and agency_id is null)
    );
end $$;

create index if not exists idx_credit_transactions_client_id
  on public.credit_transactions (client_id);

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
  elsif new.owner_type = 'client' then
    select credits_balance
      into current_balance
    from public.clients
    where id = new.client_id
    for update;

    if current_balance is null then
      raise exception 'Cliente de creditos nao encontrado para client_id=%', new.client_id;
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
  elsif new.owner_type = 'agency' then
    update public.agencies
    set credits_balance = new.balance_after,
        updated_at = now()
    where id = new.agency_id;
  else
    update public.clients
    set credits_balance = new.balance_after,
        updated_at = now()
    where id = new.client_id;
  end if;

  return new;
end;
$$;
