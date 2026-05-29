# Vuei - Type Standardization Report

## Objetivo
Padronizar contratos de dados e criar adapters compartilhados antes da fase de backend/Supabase, sem alterar layout, design ou fluxos aprovados do frontend.

## Tipos Criados

Pasta criada: `types/`

Arquivos:
- [types/trip.ts](/abs/path/types/trip.ts)
- [types/client.ts](/abs/path/types/client.ts)
- [types/agency.ts](/abs/path/types/agency.ts)
- [types/profile.ts](/abs/path/types/profile.ts)
- [types/document.ts](/abs/path/types/document.ts)
- [types/credits.ts](/abs/path/types/credits.ts)
- [types/ai.ts](/abs/path/types/ai.ts)
- [types/index.ts](/abs/path/types/index.ts)

Contratos canonicos principais:
- `Trip`
- `TripStatus`
- `TripOwnerType`
- `TripVisibility`
- `TripTraveler`
- `TripFlight`
- `TripAccommodation`
- `TripItineraryItem`
- `TripDocument`
- `TripPermissions`
- `TripCreditsSummary`
- `Client`
- `ClientStatus`
- `Agency`
- `AgencyPlan`
- `AgencyStatus`
- `AgencySettings`
- `AgencyBranding`
- `Profile`
- `UserRole`
- `ProfileSettings`
- `Document`
- `DocumentVisibility`
- `DocumentType`
- `CreditBalance`
- `CreditTransaction`
- `CreditTransactionType`
- `CreditPackage`
- `Plan`
- `AiConversation`
- `AiMessage`
- `AiUsageLog`
- `AiModule`
- `AiRole`

## Adapters Criados

Pasta criada: `lib/mappers/`

Arquivos:
- [lib/mappers/trip-mappers.ts](/abs/path/lib/mappers/trip-mappers.ts)
- [lib/mappers/credit-mappers.ts](/abs/path/lib/mappers/credit-mappers.ts)
- [lib/mappers/agency-mappers.ts](/abs/path/lib/mappers/agency-mappers.ts)
- [lib/mappers/master-mappers.ts](/abs/path/lib/mappers/master-mappers.ts)
- [lib/mappers/index.ts](/abs/path/lib/mappers/index.ts)

Funcoes principais:
- `mapStoredTripToTrip`
- `mapAgencyTripToTrip`
- `mapMasterTripToTrip`
- `mapTripToTripCard`
- `mapTripToLinkPageData`
- `mapLegacyCreditsToCreditBalance`
- `mapCreditHistoryToTransactions`
- `mapLegacyClientToClient`
- `mapAgencySettingsToAgency`
- `mapMasterAgencyToAgency`
- `mapMasterUserToProfile`

Helpers de compatibilidade:
- `extractTripsStoragePayload`
- `extractCreditsStoragePayload`
- `extractAgencyStorageState`
- `slugifyTripBase`
- `buildUniqueTripSlug`

## Contextos Ajustados

### TripsContext
- Arquivo: [contexts/trips-context.tsx](/abs/path/contexts/trips-context.tsx)
- Ajustes:
  - continua expondo a mesma API publica usada pelas telas;
  - passou a ler payload antigo e payload versionado de `vuei_trips`;
  - passou a ler payload antigo e payload versionado de `vuei_credits`;
  - persiste agora com `schemaVersion`;
  - calcula representacoes canonicas de credito (`canonicalBalance` e `canonicalTransactions`) sem quebrar o contrato antigo;
  - usa mappers compartilhados para normalizar viagens legadas.

### AgencyContext
- Arquivo: [contexts/agency-context.tsx](/abs/path/contexts/agency-context.tsx)
- Ajustes:
  - manteve a API publica atual;
  - passou a ler payload antigo e payload versionado de `vuei_agency`;
  - persiste agora com `schemaVersion`;
  - normaliza clientes e viagens pela camada de mappers;
  - aproxima a estrutura de creditos da forma canonica sem quebrar o mock atual.

### MasterContext
- Arquivo: [contexts/master-context.tsx](/abs/path/contexts/master-context.tsx)
- Ajustes:
  - alinhamento leve de tipos compartilhados para `plan`, `status` de viagem e `packages` de credito;
  - sem alterar comportamento visual nem a origem mockada em memoria.

## Compatibilidades Mantidas

- `TripsContext` continua retornando `Trip` com `name`, `shareLink`, `companions` e `passengersCount`, como as telas atuais esperam.
- `AgencyContext` continua retornando `AgencyTrip`, `Client`, `AgencyDocument` e creditos no mesmo formato consumido pelo portal da agencia.
- a pagina do link [app/viagem/[id]/page.tsx](/abs/path/app/viagem/[id]/page.tsx) foi ajustada para ler tanto payloads antigos quanto os novos payloads versionados.
- nenhum fluxo visual foi refeito.
- nenhum mock foi removido.

## Persistencia E Schema Version

Payloads versionados adicionados:
- `vuei_trips`
- `vuei_credits`
- `vuei_agency`

Comportamento:
- se o dado antigo existir no formato anterior, o app continua lendo;
- novos saves passam a gravar com `schemaVersion`;
- nao ha remocao automatica de dados antigos.

## Riscos Restantes

- `MasterContext` continua sendo uma visao em memoria, sem persistencia real e ainda com divergencias conceituais em relacao ao produto principal.
- alguns contratos de tela ainda sao legados por necessidade de compatibilidade (`name` vs `title`, `shareLink` vs `publicLink`).
- a pagina da viagem ainda monta parte do estado localmente para exibir modais e secoes mockadas; a migracao para entidades filhas reais ainda e proxima etapa.
- o build atual segue com a validacao de tipos ignorada pelo pipeline do projeto, entao existe espaco para endurecer essa camada antes da integracao real.
- existe um aviso do Next sobre multiplos lockfiles e `turbopack.root`, sem impacto funcional imediato.

## Riscos Tecnicos Antes Do Supabase

- `Trip` ja esta definido como contrato central, mas os contexts ainda armazenam formatos legados por compatibilidade.
- `adminLink` e `publicLink` ainda sao campos derivados e denormalizados no frontend.
- creditos de usuario, agencia e master ainda usam origens diferentes, apesar de estarem mais proximos do contrato final.
- o portal master ainda nao virou visao agregada real do mesmo conjunto de dados dos outros portais.

## Proximos Passos Para Supabase

### Passo 1
Usar os tipos compartilhados como base da primeira onda de tabelas:
- `profiles`
- `agencies`
- `clients`
- `trips`

### Passo 2
Criar adapters explicitos para view models das telas:
- `Trip -> link page view model`
- `Trip -> dashboard card`
- `Agency -> settings view model`
- `Profile -> portal settings view model`

### Passo 3
Migrar entidades filhas da viagem:
- `trip_travelers`
- `trip_flights`
- `trip_accommodations`
- `trip_itinerary_items`
- `documents`
- `trip_permissions`

### Passo 4
Unificar creditos e IA em tabelas reais usando os contratos definidos nesta fase.
