# Vuei - AI And Link Security Report

## Objetivo
Preparar a base tecnica de IA, concierge, leitura futura e seguranca real dos links admin/publico sem quebrar os fluxos atuais do frontend.

## SQL De IA

Arquivo criado:
- [supabase/ai.sql](/abs/path/supabase/ai.sql)

Tabelas definidas:
- `ai_conversations`
- `ai_messages`
- `ai_usage_logs`
- `ai_prompts`

### `ai_conversations`
- liga conversas a `trip`, `profile`, `agency` e `client`
- canais suportados:
  - `concierge`
  - `itinerary`
  - `documents`
  - `ticket_reader`
- status:
  - `open`
  - `closed`
  - `archived`

### `ai_messages`
- registra mensagens por conversa
- roles:
  - `user`
  - `assistant`
  - `agent`
  - `system`
- guarda `credits_used`

### `ai_usage_logs`
- registra consumo futuro por modulo
- modulos:
  - `concierge`
  - `itinerary`
  - `documents`
  - `ticket_reader`
  - `accommodation_reader`
  - `flight_reader`

### `ai_prompts`
- separa prompts por `code`, `module` e `version`
- deixa o portal master pronto para governanca futura de prompts

## RLS De IA

RLS ativada em:
- `ai_conversations`
- `ai_messages`
- `ai_usage_logs`
- `ai_prompts`

Direcao aplicada:
- traveler so acessa conversas e mensagens das proprias viagens
- agency owner/member so acessa conversas da propria agencia
- master pode ler tudo
- prompts ativos podem ser lidos; gestao de prompts fica reservada ao master

## Repository De IA

Arquivo criado:
- [lib/repositories/ai-repository.ts](/abs/path/lib/repositories/ai-repository.ts)

Funcoes preparadas:
- `listConversationsByTrip(tripId)`
- `getConversation(conversationId)`
- `createConversation(payload)`
- `listMessages(conversationId)`
- `addMessage(payload)`
- `logAiUsage(payload)`
- `listActivePrompts(module)`
- `getPromptByCode(code)`

Comportamento atual:
- fallback local/mock por padrao
- usa placeholder Supabase apenas quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true`
- nao conecta OpenAI ainda

## Modulos De IA Preparados

Arquivos criados:
- [lib/ai/ai-modules.ts](/abs/path/lib/ai/ai-modules.ts)
- [lib/ai/prompt-builder.ts](/abs/path/lib/ai/prompt-builder.ts)
- [lib/ai/credit-costs.ts](/abs/path/lib/ai/credit-costs.ts)

Modulos cobertos:
- Concierge IA
- Roteiro IA
- Leitura de passagem
- Leitura de hospedagem
- Leitura de documento
- Leitura de roteiro anexado

## Custos De Creditos Planejados

Custos mockados/futuros definidos em:
- [lib/ai/credit-costs.ts](/abs/path/lib/ai/credit-costs.ts)

Codigos:
- `concierge_message`
- `itinerary_generation`
- `document_reading`
- `ticket_reading`
- `accommodation_reading`

Observacao:
- nao ha consumo real de creditos nesta fase;
- apenas contrato e mapa de custos preparados.

## Tipos Estruturados De Resposta IA

Atualizados em:
- [types/ai.ts](/abs/path/types/ai.ts)

Tipos adicionados:
- `AiStructuredResult`
- `ExtractedFlightData`
- `ExtractedAccommodationData`
- `ExtractedDocumentData`
- `GeneratedItineraryData`

## Seguranca Dos Links

Arquivos criados:
- [lib/security/link-tokens.ts](/abs/path/lib/security/link-tokens.ts)
- [lib/mappers/trip-view-mappers.ts](/abs/path/lib/mappers/trip-view-mappers.ts)
- [LINK_SECURITY_PLAN.md](/abs/path/LINK_SECURITY_PLAN.md)

Funcoes de token:
- `generateSecureToken()`
- `generateAdminLink(slug, token)`
- `generatePublicLink(slug, token)`
- `isAdminLinkMode(params)`
- `isPublicLinkMode(params)`

## Public/Admin View

Contratos adicionados em:
- [types/trip.ts](/abs/path/types/trip.ts)

Views:
- `TripPublicView`
- `TripAdminView`

Mappers:
- `mapTripToPublicView(trip)`
- `mapTripToAdminView(trip)`
- `filterPrivateDocuments(documents)`
- `canPublicViewSection(trip, section)`

## Compatibilidade Mantida

- nenhuma tela atual foi migrada de vez para IA real
- nenhum mock foi removido
- nenhuma permissao real depende apenas do frontend novo
- a pagina da viagem continua funcional com o fluxo atual

## Proximos Passos

### Passo 1
Ligar `ai-repository` ao SDK real do Supabase por feature flag.

### Passo 2
Implementar endpoints server-side para:
- validar `adminToken`
- validar `publicToken`
- montar payload publico filtrado

### Passo 3
Integrar o provider de IA real apenas depois de:
- ledger de creditos pronto
- repository Supabase estabilizado
- controle de token e RLS fechado

### Passo 4
Criar rota publica dedicada `/v/[slug]` e remover progressivamente a dependencia de `?admin=true`.
