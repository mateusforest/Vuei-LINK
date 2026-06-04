# Vuei Credits Ledger Report

## Arquivos alterados

- `supabase/credits_ledger_setup.sql`
- `lib/repositories/credits-repository.ts`
- `lib/supabase/types.ts`
- `types/credits.ts`
- `app/portal/creditos/page.tsx`
- `app/agencia/creditos/page.tsx`
- `app/master/creditos/page.tsx`

## SQL recomendado

- `supabase/credits_ledger_setup.sql`

Esse SQL cria:

- `public.credit_transactions`
- indices de leitura por `owner_user_id`, `agency_id` e `created_at`
- trigger `apply_credit_transaction_balance` para manter `profiles.credits_balance` e `agencies.credits_balance` sincronizados
- RLS segura para:
  - traveler ler o proprio ledger
  - agencia ler o proprio ledger
  - master ler tudo
  - inserts de `grant` restritos ao master
  - inserts de `consume` permitidos apenas para o proprio owner autenticado

## O que foi preparado como real

- saldo real do viajante via `public.profiles.credits_balance`
- saldo real da agencia via `public.agencies.credits_balance`
- historico real via `public.credit_transactions`
- overview real no master:
  - total disponivel
  - total consumido
  - uso mensal
  - transacoes recentes

## Riscos corrigidos

- repository de creditos deixou de ser `supabase-placeholder` quando o modo real esta ativo
- portal e agencia deixaram de exibir apenas historico local quando o Supabase esta ativo
- master deixou de usar campanhas, transacoes e contadores fake como fonte principal
- compra de creditos continua honesta como `Em breve`, sem fingir persistencia

## O que nao foi alterado

- Stripe / pagamentos
- compra real de creditos
- fluxo de consumo em outros modulos alem da leitura nas paginas de creditos
- layouts, cards e identidade visual
- agencia, master, traveler fora do modulo de creditos

## Como testar Storage

Nao se aplica diretamente a esta fase. O ledger usa somente banco relacional.

## Como testar hospedagens

Nao se aplica diretamente a esta fase.

## Como testar links

Nao se aplica diretamente a esta fase.

## Como testar PIN dos documentos

Nao se aplica diretamente a esta fase.

## Como testar creditos depois de rodar o SQL

1. Rodar `supabase/credits_ledger_setup.sql` no Supabase SQL Editor.
2. Confirmar que a tabela `public.credit_transactions` foi criada.
3. Confirmar que `profiles.credits_balance` e `agencies.credits_balance` continuam existentes.
4. Inserir manualmente uma transacao de teste para um traveler real.
5. Abrir `/portal/creditos` e validar:
   - saldo real
   - historico real
   - erro real se RLS bloquear
6. Inserir manualmente uma transacao de teste para uma agencia real.
7. Abrir `/agencia/creditos` e validar:
   - saldo real
   - historico real
8. Abrir `/master/creditos` com usuario `master` e validar:
   - contadores reais
   - transacoes recentes
   - saldos atuais

## Limitacoes restantes

- compra/pagamento ainda nao existe
- criacao de pacotes no master continua nao operacional
- o consumo real em outros modulos pode ser conectado na proxima fase ao `consumeCredits()`
- antes de rodar o SQL, as paginas mostram erro honesto caso a tabela ainda nao exista
