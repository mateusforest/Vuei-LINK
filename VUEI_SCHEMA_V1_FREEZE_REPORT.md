# Vuei Schema V1 Freeze Report

## SQLs antigos consolidados

O arquivo `supabase/vuei_schema_v1_final.sql` consolida a intencao funcional destes arquivos versionados:

- `supabase/schema.sql`
- `supabase/documents.sql`
- `supabase/ai.sql`
- `supabase/ai_conversations_setup.sql`
- `supabase/trip_hotels.sql`
- `supabase/credits_ledger_setup.sql`
- `supabase/storage_documents_bucket.sql`
- `supabase/storage_profile_bucket.sql`
- `supabase/rls_phase_2_fix.sql`
- `supabase/agency_persistence_fix.sql`
- `supabase/agency_members_rls_review.sql` (somente a parte recomendada de RLS)

Os arquivos de auditoria/revisao como `cleanup_mock_data_review.sql`, `concierge_rls_review.sql` e outros reviews nao foram “executados” nem copiados cegamente; eles serviram como insumo de risco e alinhamento.

## Tabelas que o codigo atual espera

Camada principal:

- `public.profiles`
- `public.agencies`
- `public.agency_members`
- `public.clients`
- `public.trips`
- `public.documents`
- `public.trip_hotels`

IA / concierge:

- `public.ai_conversations`
- `public.ai_messages`
- `public.ai_usage_logs`
- `public.ai_prompts`

Creditos:

- `public.credit_transactions`

Storage:

- bucket `vuei-documents`
- bucket `vuei-avatars`

## O que o SQL final cria / garante

O SQL final:

- cria as tabelas ausentes com `create table if not exists`
- adiciona colunas faltantes com `alter table add column if not exists`
- adiciona indices com `create index if not exists`
- recria funções auxiliares com `create or replace function`
- recria triggers de `updated_at`
- recria a trigger de ledger de creditos
- habilita RLS em todas as tabelas operacionais
- recria policies relevantes com `drop policy if exists` antes de `create policy`
- cria buckets de Storage se ainda nao existirem
- recria policies de Storage para documentos e avatares
- inclui migracao suave para drift conhecido:
  - `ai_conversations.user_id -> owner_user_id`
  - `ai_conversations.channel -> source`
  - `trip_hotels.hotel_name -> name`
  - `trip_hotels.confirmation_number -> confirmation_code`

## O que o SQL final nao altera

O SQL final nao:

- usa `drop table`
- usa `truncate`
- apaga dados
- limpa mocks do banco
- remove colunas antigas legadas
- cria billing/pagamento
- resolve escrita anonima segura para concierge
- cria backend seguro para admin link sem sessao

## Principais riscos encontrados

### 1. Drift entre `ai.sql` e o schema usado pelo codigo atual

O maior drift encontrado foi na IA:

- `supabase/ai.sql` ainda estava no modelo antigo com `ai_conversations.user_id` e `channel`
- `lib/repositories/ai-repository.ts` e `lib/supabase/types.ts` ja usam `owner_user_id` e `source`

O freeze consolidou o modelo novo porque ele e o que o codigo atual consome.

### 2. RLS de `profiles` continua conservadora

O schema final manteve `profiles` com leitura segura por:

- proprio usuario
- master

Isso protege dados, mas mantem uma limitacao pratica:

- o fluxo de vincular membro por email na agencia depende de `getProfileByEmail()`
- sem backend de convite/busca mediada, essa consulta pode continuar limitada em ambientes com RLS mais fechada

O SQL final nao abre leitura ampla de `profiles` para nao violar menor privilegio.

### 3. Leitura publica segura de trips/documentos continua restrita

O freeze incluiu policy publica segura para:

- `trips` com `visibility = 'public'`
- `documents` com `visibility = 'public_trip'` e `is_private = false`

Mas nao abre:

- conversa anonima no concierge
- escrita anonima
- leitura irrestrita de viagens privadas

### 4. Escrita sem sessao continua fora do banco

O schema final nao cria backdoor para:

- link admin sem sessao salvar alteracoes
- concierge publico sem sessao persistir historico com seguranca

Esses casos continuam precisando de camada backend/token seguro no futuro.

## Ordem recomendada para rodar

1. Fazer backup/snapshot do banco atual no Supabase.
2. Revisar `supabase/vuei_schema_v1_final.sql` inteiro.
3. Rodar o SQL no SQL Editor do Supabase.
4. Validar buckets e policies de Storage.
5. Validar RLS com contas reais:
   - traveler
   - agency_owner
   - agency_member
   - master
6. Validar fluxos principais no app publicado.

## Checklist de validacao pos-SQL

### Estrutura

- [ ] `profiles` existe com `credits_balance` e `settings`
- [ ] `agencies` existe com `branding`, `settings` e `credits_balance`
- [ ] `agency_members` existe e aceita owner/admin/member/viewer
- [ ] `clients` existe com `agency_id`
- [ ] `trips` existe com `owner_type`, `agency_id`, `client_id`, `slug`, `links` e `visibility`
- [ ] `documents` existe com `visibility`, `is_private`, `file_path`
- [ ] `trip_hotels` existe e aceita varias hospedagens por viagem
- [ ] `ai_conversations` existe no modelo novo
- [ ] `ai_messages` existe
- [ ] `ai_usage_logs` existe
- [ ] `ai_prompts` existe
- [ ] `credit_transactions` existe

### Storage

- [ ] bucket `vuei-documents` existe
- [ ] bucket `vuei-avatars` existe
- [ ] upload de avatar funciona
- [ ] upload de documento funciona para dono autenticado

### RLS

- [ ] traveler le seu profile
- [ ] traveler le suas trips
- [ ] agency_owner le sua agencia
- [ ] agency_owner le/cria clientes da propria agencia
- [ ] agency_owner le/cria trips da propria agencia
- [ ] master le `profiles`, `agencies`, `clients`, `trips`, `documents`
- [ ] public link le somente trips publicas
- [ ] public link nao le documentos privados

### Modulos

- [ ] portal viajante continua lendo trips reais
- [ ] portal agencia continua lendo clientes/viagens reais
- [ ] portal master continua lendo dados reais
- [ ] concierge deixa de falhar por tabela ausente
- [ ] creditos conseguem ler saldo e ledger reais

## Observacoes finais

Este freeze foi construído com base no contrato que o codigo atual realmente espera, especialmente:

- `lib/repositories/*`
- `lib/supabase/types.ts`

Ou seja, ele foi consolidado para reduzir SQLs soltos futuros, mas sem esconder os pontos que ainda dependem de backend seguro ou de decisoes de produto fora do banco.
