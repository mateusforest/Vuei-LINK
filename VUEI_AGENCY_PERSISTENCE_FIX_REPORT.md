# Vuei Agency Persistence Fix Report

## Causa exata do problema

O problema principal estava no fluxo da agencia, nao no Master.

Os pontos que impediam a persistencia real eram:

1. `public.profiles` era criado com `role = agency_owner`, mas o fluxo de criacao da agencia nao estava protegido contra falhas parciais.
2. `createAgency()` podia deixar a UX seguir em frente mesmo quando `agencies`, `agency_members` ou `profiles.agency_id` nao eram persistidos corretamente.
3. O `AgencyContext` ainda deixava o portal parecer operacional mesmo sem uma agencia real carregada do Supabase.
4. Algumas telas do portal agencia fechavam modal, mostravam toast ou continuavam o fluxo sem confirmar sucesso real no banco.
5. Em modo Supabase ativo, ainda existiam pontos com fallback local/visual em vez de erro honesto.

Em resumo: havia combinacao de fluxo incompleto, erros parcialmente engolidos e UI otimista demais.

## O que foi corrigido

### 1. Cadastro da agencia

Arquivos:

- `app/agency/signup/page.tsx`
- `lib/repositories/agencies-repository.ts`

Fluxo reforcado:

1. cria `auth.users`
2. garante `public.profiles` com `role = agency_owner`
3. cria `public.agencies`
4. cria `public.agency_members`
5. atualiza `public.profiles.agency_id`

Se qualquer etapa falhar:

- nao mostra sucesso;
- nao redireciona como se estivesse tudo certo;
- mostra erro real na tela;
- registra erro claro no console.

Tambem foi mantida a regra de so redirecionar automaticamente o owner quando ja existe `profile.agencyId`.

### 2. Bootstrap real da agencia

Arquivo:

- `contexts/agency-context.tsx`

Agora, com `NEXT_PUBLIC_USE_SUPABASE_DATA=true`:

- tenta resolver a agencia por `profile.agencyId`;
- se estiver nulo, tenta por `owner_user_id`;
- se encontrar a agencia, sincroniza `profiles.agency_id`;
- se nao encontrar, entra em estado de setup incompleto;
- nao cria dados fake;
- nao usa `localStorage` como se fosse agencia real.

### 3. Clientes reais

Arquivos:

- `lib/repositories/clients-repository.ts`
- `app/agencia/clientes/page.tsx`
- `app/agencia/page.tsx`

Agora:

- `createClient` exige `agency_id` em modo Supabase;
- se o insert falhar, retorna erro real;
- o modal nao fecha mais quando o cliente nao persistiu;
- a tela mostra erro honesto em vez de sucesso visual.

### 4. Viagens reais da agencia

Arquivos:

- `lib/repositories/trips-repository.ts`
- `app/agencia/viagens/criar/page.tsx`
- `app/agencia/viagens/page.tsx`
- `app/agencia/links/page.tsx`

Agora:

- `createTrip` da agencia exige `agency_id`;
- grava `owner_type = agency`;
- grava `agency_id`;
- grava `client_id` quando existir;
- usa `slug` real;
- usa `public_link = https://www.meuvuei.com/v/[slug]`;
- usa `admin_link = https://www.meuvuei.com/viagem/[slug]/admin`;
- grava `visibility = public` para o fluxo da agencia;
- nao cria viagem local se o Supabase falhar;
- nao gera experiencia de sucesso para viagem inexistente.

O formulario de criacao de viagem agora mostra erro real e nao conclui o fluxo se a persistencia falhar.

### 5. Configuracoes reais da agencia

Arquivo:

- `app/agencia/configuracoes/page.tsx`

Agora:

- o botao salvar so mostra sucesso se `updateAgency` voltar com `data`;
- o botao de branding/foto nao finge persistencia se a agencia real nao existir;
- a selecao de plano ficou honesta: seleciona localmente, mas avisa quando ainda falta salvar no Supabase.

## Arquivos alterados

- `app/agency/signup/page.tsx`
- `contexts/agency-context.tsx`
- `lib/repositories/agencies-repository.ts`
- `lib/repositories/clients-repository.ts`
- `lib/repositories/trips-repository.ts`
- `app/agencia/page.tsx`
- `app/agencia/clientes/page.tsx`
- `app/agencia/viagens/criar/page.tsx`
- `app/agencia/viagens/page.tsx`
- `app/agencia/links/page.tsx`
- `app/agencia/configuracoes/page.tsx`
- `supabase/agency_persistence_fix.sql`

## Queries e repositories envolvidos

### Agencies

- `getAgencyByOwner(userId)`
- `getAgencyById(id)`
- `createAgency(payload)`
- `updateAgency(id, payload)`

### Clients

- `listClients(agencyId)`
- `createClient(payload)`
- `updateClient(id, payload)`
- `deleteClient(id)`

### Trips

- `listTripsByAgency(agencyId)`
- `createTrip(payload)`
- `updateTrip(id, payload)`
- `deleteTrip(id)`

## SQL necessario

Arquivo gerado para revisao manual:

- `supabase/agency_persistence_fix.sql`

Motivo:

- consolidar policy segura para `agencies insert/select/update`;
- consolidar `agency_members insert/select/update`;
- adicionar `delete` seguro para `clients`;
- adicionar `delete` seguro para `trips`.

Nada foi executado automaticamente no Supabase.

## Limitacoes restantes

1. `documents` da agencia ainda nao virou um fluxo completo de upload operacional nesta rodada.
   Hoje o sistema ficou honesto: nao finge que salvou quando nao salvou.

2. `roteiros IA`, `concierge`, creditos e areas fora do escopo continuam fora desta rodada.

3. Se o banco ainda nao tiver as policies corretas para criacao da agencia, o frontend agora vai falhar com erro real em vez de mascarar sucesso.

## Como testar cadastro da agencia

1. Criar uma nova conta em `/agency/signup`.
2. Confirmar no Supabase:
   - `auth.users` com o usuario novo;
   - `public.profiles` com `role = agency_owner`;
   - `public.agencies` com `owner_user_id = user.id`;
   - `public.agency_members` com `profile_id = user.id`, `role = owner`, `status = active`;
   - `public.profiles.agency_id = agencies.id`.
3. Se qualquer uma dessas etapas falhar, a UI deve mostrar erro e nao deve seguir como se a agencia estivesse pronta.

## Como testar cliente real

1. Entrar no portal agencia com conta que ja tenha agencia persistida.
2. Ir para `/agencia/clientes`.
3. Criar um cliente novo.
4. Confirmar no Supabase:
   - novo registro em `public.clients`;
   - `agency_id` correto.
5. Se falhar, o modal deve permanecer aberto e a tela deve mostrar erro honesto.

## Como testar viagem real da agencia

1. Entrar em `/agencia/viagens/criar`.
2. Criar uma viagem para um cliente real.
3. Confirmar no Supabase:
   - novo registro em `public.trips`;
   - `owner_type = agency`;
   - `agency_id` correto;
   - `client_id` correto quando selecionado;
   - `slug`, `public_link` e `admin_link` preenchidos.
4. Confirmar que a viagem aparece em:
   - `/agencia/viagens`
   - `/agencia/links`
   - `/master/viagens`

## Como validar o Master refletindo os dados

Depois de criar agencia, cliente e viagem reais:

1. abrir `/master`;
2. verificar:
   - total de agencias > 0;
   - total de clientes > 0;
   - total de viagens > 0;
   - listagens recentes refletindo os registros reais.

## Build

Validacao executada:

```bash
pnpm run build
```

Resultado:

- build passou com sucesso.
