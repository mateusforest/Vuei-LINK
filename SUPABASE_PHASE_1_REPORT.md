# Vuei - Supabase Phase 1 Report

## Objetivo
Preparar a base inicial do Supabase para o Vuei sem migrar telas ainda do `localStorage` para o backend.

## Arquivos Criados
- [supabase/schema.sql](/abs/path/supabase/schema.sql)
- [lib/supabase/client.ts](/abs/path/lib/supabase/client.ts)
- [lib/supabase/server.ts](/abs/path/lib/supabase/server.ts)
- [lib/supabase/types.ts](/abs/path/lib/supabase/types.ts)
- [.env.example](/abs/path/.env.example)

## Tabelas Definidas No SQL

Primeira onda criada em `schema.sql`:
- `profiles`
- `agencies`
- `agency_members`
- `clients`
- `trips`

## Constraints Principais

### `profiles`
- `role` limitado a:
  - `traveler`
  - `agency_owner`
  - `agency_member`
  - `master`
- `credits_balance >= 0`
- `id` referencia `auth.users(id)` com `on delete cascade`

### `agencies`
- `plan` limitado a:
  - `starter`
  - `pro`
  - `enterprise`
- `status` limitado a:
  - `pending`
  - `active`
  - `suspended`
  - `archived`
- `credits_balance >= 0`
- `owner_user_id` referencia `profiles(id)`

### `agency_members`
- `agency_id + profile_id` unico
- `role` limitado a:
  - `owner`
  - `admin`
  - `member`
  - `viewer`
- `status` limitado a:
  - `pending`
  - `active`
  - `inactive`

### `clients`
- `status` limitado a:
  - `lead`
  - `active`
  - `inactive`
  - `archived`

### `trips`
- `status` limitado a:
  - `draft`
  - `upcoming`
  - `ongoing`
  - `completed`
  - `cancelled`
- `owner_type` limitado a:
  - `traveler`
  - `agency`
- `visibility` limitado a:
  - `private`
  - `public`
- `travelers_count >= 1`
- consistencia de owner:
  - `traveler` exige `owner_user_id`
  - `agency` exige `agency_id` e `client_id`

## Indices Criados
- `idx_profiles_role`
- `idx_agencies_slug`
- `idx_trips_slug`
- `idx_trips_admin_token`
- `idx_trips_public_token`
- `idx_trips_owner_user_id`
- `idx_trips_agency_id`
- `idx_trips_client_id`
- `idx_clients_agency_id`
- `idx_agency_members_agency_id`
- `idx_agency_members_profile_id`

## Updated At

Foi criada a funcao:
- `public.set_updated_at()`

E aplicada via trigger em:
- `profiles`
- `agencies`
- `clients`
- `trips`

## RLS Inicial

RLS ativada em:
- `profiles`
- `agencies`
- `agency_members`
- `clients`
- `trips`

Helpers criados:
- `public.is_master_user()`
- `public.is_agency_member(target_agency_id uuid)`
- `public.is_agency_owner(target_agency_id uuid)`

Politicas principais:

### Profiles
- usuario pode ler o proprio profile
- usuario pode atualizar o proprio profile
- usuario pode inserir o proprio profile
- master pode ler todos

### Agencies
- owner/member pode ler a propria agencia
- owner pode atualizar a propria agencia
- master pode ler todas

### Agency Members
- membro pode ler memberships da propria agencia
- o proprio usuario pode ler sua membership
- master pode ler todas

### Clients
- owner/member pode ler clientes da propria agencia
- owner/member pode inserir cliente na propria agencia
- owner/member pode atualizar cliente da propria agencia
- master pode ler todos

### Trips
- traveler pode ler/inserir/atualizar viagens proprias
- owner/member pode ler/inserir/atualizar viagens da propria agencia
- master pode ler todas

Observacao:
- acesso publico por link/token ainda nao foi implementado por RLS nesta fase.

## Variaveis Necessarias

Arquivo exemplo criado:
- [.env.example](/abs/path/.env.example)

Variaveis:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Client Supabase Preparado

Arquivos criados:
- [lib/supabase/client.ts](/abs/path/lib/supabase/client.ts)
- [lib/supabase/server.ts](/abs/path/lib/supabase/server.ts)
- [lib/supabase/types.ts](/abs/path/lib/supabase/types.ts)

Estado atual:
- a camada esta preparada com configuracao e tipagem;
- nao foi conectado o SDK do Supabase ainda;
- nao houve migracao de nenhuma tela;
- o frontend continua funcionando com mocks e `localStorage`.

## Riscos

- `adminLink` ainda depende do modelo atual do frontend e precisara token seguro real depois.
- acesso publico ao link ainda nao tem politica RLS dedicada.
- `profiles.agency_id` e `agency_members` coexistem; sera preciso definir o papel exato de cada um na camada final.
- documentos privados ainda nao entraram em storage nem em RLS de bucket.
- creditos ainda nao usam ledger real no app, apesar de o plano de dados ja estar preparado.

## Proximos Passos

### Passo 1
Adicionar o SDK do Supabase e ligar apenas a leitura/escrita da primeira onda:
- `profiles`
- `agencies`
- `clients`
- `trips`

### Passo 2
Criar adaptadores de ida e volta entre `localStorage` e payload Supabase para migracao gradual.

### Passo 3
Implementar acesso administrativo seguro da viagem com `admin_token`.

### Passo 4
Implementar acesso publico do link com dados filtrados e politicas dedicadas.

### Passo 5
Entrar na segunda onda:
- `trip_travelers`
- `trip_flights`
- `trip_accommodations`
- `trip_itinerary_items`
- `documents`
- `trip_permissions`
