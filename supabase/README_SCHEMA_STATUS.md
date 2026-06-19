# Supabase SQL Status

Este diretório mistura SQLs com papéis diferentes. Eles não devem ser tratados todos como a mesma fonte de verdade.

## Arquivos legados / snapshots

- `vuei_schema_v1_final.sql`
  - Snapshot consolidado antigo.
  - Útil para revisão histórica e comparação.
  - Não representa sozinho o schema atual usado em runtime.
  - Não deve ser executado em bloco sem reconciliar com os SQLs modulares mais novos e com o schema real do Supabase.

- `ai.sql`
  - Arquivo histórico do módulo de IA.
  - Ainda pode servir como referência para `ai_conversations`, `ai_messages` e `ai_prompts`.
  - O bloco de `ai_usage_logs` aqui está defasado em relação ao runtime atual.

## Arquivos modulares atualmente mais confiáveis

- `ai_usage_logs.sql`
  - Referência atual para `ai_usage_logs`.
  - Usa o modelo compatível com o runtime atual (`owner_user_id`, `feature`, `credit_amount`, `status`, tokens, metadata).

- `agency_billing.sql`
  - Referência atual para `agency_subscriptions` e `agency_plan_credit_cycles`.

- `traveler_billing.sql`
  - Referência atual para `traveler_subscriptions`, `traveler_plan_credit_cycles` e `stripe_events`.

- `credits_ledger_setup.sql`
  - Referência atual do ledger de créditos (`credit_transactions`, `balance_after`, trigger de saldo).

- `trip_itineraries.sql`
  - Referência atual para `trip_itineraries`.

- `trip_hotels.sql`
  - Referência atual para `trip_hotels`, incluindo alinhamentos recentes como `document_id`.

## Regra prática

Ao reconciliar ambiente novo:

1. Não usar `vuei_schema_v1_final.sql` como fonte única de verdade.
2. Priorizar os SQLs modulares mais recentes.
3. Confirmar o schema real do Supabase antes de criar novas migrations.
4. Criar migrations idempotentes separadas quando surgir divergência comprovada.

## Observação desta reconciliação

Nenhum SQL foi executado em banco nesta revisão. Esta etapa apenas documenta o status dos arquivos versionados.
