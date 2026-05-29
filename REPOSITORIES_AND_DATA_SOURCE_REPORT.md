# Repositories And Data Source Report

## O que foi criado

- `lib/data-source.ts`
- `lib/local-storage-migration.ts`
- `lib/repositories/trips-repository.ts`
- `lib/repositories/clients-repository.ts`
- `lib/repositories/agencies-repository.ts`
- `lib/repositories/profiles-repository.ts`
- `lib/repositories/credits-repository.ts`
- `lib/repositories/index.ts`

## Repositories consolidados

- `trips-repository`
  - `listTrips`
  - `getTripById`
  - `getTripBySlug`
  - `getTripByAdminToken`
  - `getTripByPublicToken`
  - `createTrip`
  - `updateTrip`
  - `deleteTrip`
  - `listTripsByUser`
  - `listTripsByAgency`
  - `listTripsByClient`
- `clients-repository`
  - `listClients`
  - `getClientById`
  - `createClient`
  - `updateClient`
  - `deleteClient`
  - `listClientsWithTrips`
- `agencies-repository`
  - `getAgencyById`
  - `getAgencyBySlug`
  - `getAgencyByOwner`
  - `updateAgency`
  - `listAgencyMembers`
  - `addAgencyMember`
  - `updateAgencyMember`
- `profiles-repository`
  - `getProfile`
  - `getProfileByEmail`
  - `createProfile`
  - `updateProfile`
  - `listProfiles`
  - `listProfilesByAgency`
- `credits-repository`
  - `getCreditBalance`
  - `listCreditTransactions`
  - `listCreditPackages`
  - `listPlans`
  - `addCreditTransaction`
  - `consumeCredits`
  - `grantCredits`
- `documents-repository`
  - mantido e alinhado ao novo `data-source`
- `ai-repository`
  - mantido e alinhado ao novo `data-source`

## Feature flag

`lib/data-source.ts` centraliza a decisao:

- usa Supabase somente quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true`
- exige `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- sem env ou flag, o app permanece em `local`
- nenhuma tela quebra por ausencia de configuracao

## Fallback local/mock

- `lib/local-storage-migration.ts` concentra leitura defensiva de:
  - `vuei_trips`
  - `vuei_agency`
  - `vuei_credits`
- os repositories retornam dados normalizados com os tipos canônicos
- dados antigos continuam validos porque os mappers legados seguem sendo usados

## Contextos preparados

- `TripsContext`
  - mantido com `localStorage` como fonte atual
  - recebeu anotacao tecnica para futura troca por `trips-repository` e `credits-repository`
- `AgencyContext`
  - mantido com persistencia local atual
  - preparado para migrar depois para `clients`, `trips` e `documents` repositories
- `MasterContext`
  - mantido mockado
  - documentado como etapa posterior de agregacao

## Plano de troca por contexto

- Fase seguinte do viajante:
  - mover leituras de viagens para `trips-repository`
  - manter escrita dupla local enquanto Supabase ainda estiver em rollout
- Fase seguinte da agencia:
  - mover clientes para `clients-repository`
  - mover viagens para `trips-repository`
  - mover documentos para `documents-repository`
- Fase seguinte do master:
  - criar camada agregadora baseada em repositories canônicos

## Riscos restantes

- alguns repositories locais ainda refletem parcialmente o shape legado dos contexts
- `MasterContext` continua com fonte mockada isolada
- atualizacao local de viagens da agencia preserva compatibilidade, mas ainda nao replica todos os subcampos canônicos
- a escrita Supabase continua placeholder de proposito nesta fase

## Proximos passos para Supabase

- conectar `trips-repository` ao client Supabase
- migrar `profiles`, `agencies`, `clients` e `trips` com rollout por feature flag
- depois ativar leitura real em telas selecionadas antes da troca completa dos contexts
