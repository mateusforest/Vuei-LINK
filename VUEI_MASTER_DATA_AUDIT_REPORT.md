# Vuei Master Data Audit Report

## 1. Causa raiz encontrada

O problema principal da camada Master nao estava no layout nem nas telas, e sim na combinacao de dois fatores na camada de dados:

1. `contexts/master-context.tsx` carregava os dados apenas uma vez e nao reagia explicitamente ao estado autenticado real do usuario master.
2. Alguns repositories ainda podiam cair em fallback local ou placeholder silencioso quando o Supabase browser client nao estivesse pronto, o que mascarava falhas reais de leitura.

Na pratica, isso gerava um Master inconsistente:

- `profiles` podia aparecer parcialmente;
- `agencies`, `clients`, `trips` e `documents` podiam vir vazios;
- erros de leitura ficavam pouco visiveis;
- o dashboard passava a refletir mais o estado do bootstrap do client do que o estado real do banco.

## 2. O que foi auditado

Arquivos auditados:

- `contexts/master-context.tsx`
- `lib/repositories/profiles-repository.ts`
- `lib/repositories/agencies-repository.ts`
- `lib/repositories/clients-repository.ts`
- `lib/repositories/documents-repository.ts`
- `lib/repositories/trips-repository.ts`
- `app/master/page.tsx`
- `app/master/usuarios/page.tsx`
- `app/master/agencias/page.tsx`
- `app/master/viagens/page.tsx`
- `app/master/analytics/page.tsx`
- `app/master/layout.tsx`

## 3. Consultas corrigidas

### Profiles

Repository:

- `listProfiles()`
- `listProfilesByAgency()`
- `getProfile()`
- `getProfileByEmail()`

Correcao:

- em modo Supabase ativo, nao cai mais em dado local quando o browser client nao esta disponivel;
- agora retorna erro/placeholder explicito em vez de parecer que a leitura real aconteceu.

### Agencies

Repository:

- `listAgencies()`
- `listAgencyMembers()`

Correcao:

- em modo Supabase ativo, nao volta mais para estado local silencioso;
- erro/placeholder passa a ser explicitado.

### Clients

Repository:

- `listAllClients()`
- `getClientById()`
- `listClientsWithTrips()`

Correcao:

- sem fallback local operacional quando o Supabase deveria ser a fonte principal.

### Trips

Repository:

- `listTrips()`

Correcao:

- em modo Supabase ativo, nao usa mais `localStorage` como fonte silenciosa para o Master.

### Documents

Repository:

- `listDocuments()`
- `listDocumentsByTrip()`
- `listDocumentsByClient()`
- `listPublicTripDocuments()`

Correcao:

- sem fallback local silencioso em modo Supabase ativo.

## 4. Filtros removidos ou validados

### Usuarios

O Master agora depende de `listProfiles()` sem filtros ocultos por role.

Continuam validos apenas filtros explicitamente pedidos pela UI:

- busca por nome/email
- filtro visual por tipo na tela `/master/usuarios`

### Agencias

`listAgencies()` continua lendo todas as agencias reais da tabela `public.agencies`.

Nao ha filtro por owner, status ou agency_id no repository do Master.

### Clientes

`listAllClients()` continua lendo todos os registros reais de `public.clients`.

### Viagens

`listTrips()` continua lendo todos os registros reais de `public.trips` quando chamado sem parametros.

### Documentos

`listDocuments()` continua lendo todos os registros reais de `public.documents` quando chamado sem parametros.

## 5. Arquivos alterados

- `contexts/master-context.tsx`
- `lib/repositories/profiles-repository.ts`
- `lib/repositories/agencies-repository.ts`
- `lib/repositories/clients-repository.ts`
- `lib/repositories/documents-repository.ts`
- `lib/repositories/trips-repository.ts`

## 6. O que foi corrigido na camada Master

### MasterContext

Agora o `MasterProvider`:

- espera o bootstrap de auth terminar;
- so tenta carregar dados reais quando existe `user` autenticado;
- so carrega a operacao quando `profile.role === "master"`;
- reseta o estado se nao houver sessao master valida;
- volta a carregar quando `loading`, `user.id` ou `profile.role` mudam.

Tambem passei a registrar erro especifico de leitura de `agency_members`, que antes nao entrava nas notificacoes do Master.

### Dashboard

Os cards continuam baseados em dados reais agregados:

- `public.profiles`
- `public.agencies`
- `public.clients`
- `public.trips`
- `public.documents`

Sem fallback local.
Sem mocks.

## 7. Problemas restantes

1. Se o banco de producao estiver divergente dos SQLs versionados no repo, o Master ainda pode receber vazio por RLS, mesmo com o codigo corrigido.

2. As policies de `documents` vivem em `supabase/documents.sql`, enquanto boa parte do resto da base vive em `supabase/schema.sql`. Isso aumenta o risco de drift entre ambientes.

3. O Master hoje esta correto para leitura operacional, mas ainda nao implementa fluxo operacional de edicao global. Isso continua fora do escopo.

## 8. RLS auditada

Pelo codigo SQL versionado no projeto:

- `profiles_select_own_or_master` existe;
- `agencies_select_own_or_master` existe;
- `clients_select_same_agency_or_master` existe;
- `trips_select_owner_agency_or_master` existe;
- `documents_select_owner_agency_or_master` existe em `supabase/documents.sql`.

Conclusao desta rodada:

- nao foi necessario gerar SQL novo automaticamente;
- a causa principal encontrada foi de codigo/bootstrapping/fallback silencioso;
- ainda assim, vale conferir no ambiente real se essas policies estao de fato aplicadas no projeto Supabase em producao.

## 9. Recomendacoes futuras

1. Consolidar as migrations/policies em arquivos versionados unicos e aplicados de forma controlada no Supabase real.
2. Adicionar estado explicito de `loading` e `lastSync` no `MasterContext` para auditoria operacional.
3. Criar tela propria de clientes no Master, caso o produto queira visibilidade direta em vez de contagem agregada.
4. Adicionar log seguro por repository quando a leitura falhar por RLS, para diferenciar:
   - sem sessao
   - client indisponivel
   - policy bloqueando
   - erro de schema

## 10. Como validar manualmente

1. Fazer login com usuario `master`.
2. Abrir `/master`.
3. Confirmar contadores:
   - usuarios = `count(*)` de `public.profiles`
   - agencias = `count(*)` de `public.agencies`
   - clientes = `count(*)` de `public.clients`
   - viagens = `count(*)` de `public.trips`
   - documentos = `count(*)` de `public.documents`
4. Abrir:
   - `/master/usuarios`
   - `/master/agencias`
   - `/master/viagens`
   - `/master/analytics`
5. Verificar se os dados batem com o Supabase real.
6. Se continuar vendo vazio:
   - inspecionar as notificacoes do Master;
   - comparar as policies reais do ambiente com os SQLs do repo.

## 11. Build

Validacao executada:

```bash
pnpm run build
```

Resultado:

- build passou com sucesso.
