# Vuei Master Users & Agencies Fix

## Causa raiz encontrada

O problema desta rodada estava em dois pontos combinados:

1. O `MasterContext` ja fazia leitura ampla de `profiles` e `agencies`, mas a UI nao deixava claro quando essas consultas falhavam por RLS, sessao ou cliente Supabase indisponivel.
2. Alguns repositories ainda podiam mascarar falhas em modo Supabase, retornando listas vazias ou fallback local sem expor erro suficiente para o Portal Master.

Com isso, o sintoma visual ficava parecido com "so existe o master", quando na pratica a consulta podia estar falhando ou sendo esvaziada silenciosamente.

## O que foi corrigido

- `contexts/master-context.tsx`
  - passou a expor erros separados de leitura para `profiles`, `agencies`, `agency_members`, `clients`, `trips` e `documents`;
  - registra erro real no console para leitura de usuarios e agencias;
  - limpa estado apenas quando a sessao nao e `master`, sem inventar dados.

- `lib/repositories/agencies-repository.ts`
  - `listAllAgencyMembers()` nao cai mais em fallback local silencioso quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true` e o client nao esta disponivel;
  - agora retorna erro real de placeholder Supabase, coerente com os outros repositories.

- `app/master/page.tsx`
  - mostra erro real quando a leitura de usuarios ou agencias falha.

- `app/master/usuarios/page.tsx`
  - mostra erro real da consulta de `public.profiles` em vez de apenas uma tela vazia.

- `app/master/agencias/page.tsx`
  - mostra erro real da consulta de `public.agencies`;
  - quando nao ha erro e a tabela esta vazia, continua com estado vazio honesto.

## Consultas corrigidas / validadas

- `listProfiles()`
  - leitura de `public.profiles` sem filtro oculto por role;
  - continua aceitando filtro opcional apenas quando chamado explicitamente com parametros.

- `listAgencies()`
  - leitura de `public.agencies` sem mock operacional em modo Supabase.

- `listAllAgencyMembers()`
  - leitura de `public.agency_members` sem fallback local em modo Supabase.

## Filtros removidos

Nenhum filtro funcional precisou ser removido de `profiles` ou `agencies`, porque o codigo auditado desta rodada nao filtrava apenas `master`.

O ajuste foi remover o efeito de "filtro invisivel" causado por fallback silencioso e falta de surfacing de erro real.

## SQL necessario

Nenhum SQL novo foi gerado nesta rodada.

Motivo:

- o arquivo `supabase/schema.sql` ja contem politicas de leitura especificas para `master` em:
  - `public.profiles`
  - `public.agencies`
  - `public.agency_members`
- as funcoes `public.is_master_user()` e as policies `profiles_select_own_or_master` e `agencies_select_own_or_master` ja existem no schema versionado do projeto.

Se o problema persistir no ambiente real mesmo com este fix, a causa mais provavel passa a ser drift entre o banco ativo e o SQL versionado no repositorio.

## Arquivos alterados

- `contexts/master-context.tsx`
- `lib/repositories/agencies-repository.ts`
- `app/master/page.tsx`
- `app/master/usuarios/page.tsx`
- `app/master/agencias/page.tsx`

## Problemas restantes

- Se o banco ativo nao estiver com as policies equivalentes ao `supabase/schema.sql`, o Master ainda pode receber erro real de RLS ao ler `profiles` ou `agencies`.
- Esta rodada nao altera `Master` para escrita; ela foca apenas na leitura confiavel e honesta.

## Como testar

1. Entrar com um usuario com `profile.role = master`.
2. Abrir `/master`.
3. Validar:
   - card de usuarios = `count(*)` real de `public.profiles`;
   - card de agencias = `count(*)` real de `public.agencies`.
4. Abrir `/master/usuarios`.
   - todos os `profiles` reais devem aparecer: `traveler`, `agency_owner`, `agency_member`, `master`.
5. Abrir `/master/agencias`.
   - se existirem agencias reais, devem listar normalmente;
   - se nao existirem, deve aparecer estado vazio honesto;
   - se a policy falhar, a tela deve mostrar o erro real.
