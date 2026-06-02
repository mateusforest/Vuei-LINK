# Vuei Stability Audit Report

Data: 2026-06-01

## Escopo auditado

- `contexts/auth-context.tsx`
- `components/auth/route-guard.tsx`
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/agency/signup/page.tsx`
- `lib/auth/ensure-profile.ts`
- `lib/auth/get-current-profile.ts`
- `lib/repositories/profiles-repository.ts`
- `app/portal/layout.tsx`
- `app/portal/page.tsx`

Nao existe `middleware.ts` no projeto neste momento.

## Tabelas usadas no fluxo atual

- `public.profiles`
  - fonte real de nome, email, avatar, role e settings
- `public.agencies`
  - usada no bootstrap e no cadastro da agencia
- `public.agency_members`
  - usada no fluxo da agencia para vinculos de equipe
- `public.trips`
  - usada para dashboard do usuario, portal da agencia e links da viagem

## Policies relevantes hoje

Base em `supabase/schema.sql`:

- `profiles_select_own_or_master`
- `profiles_update_own`
- `profiles_insert_own`
- `agencies_select_own_or_master`
- `agencies_update_owner`
- `agency_members_select_same_agency_or_master`
- `clients_select_same_agency_or_master`
- `clients_insert_same_agency`
- `clients_update_same_agency`
- `trips_select_owner_agency_or_master`
- `trips_insert_owner_or_agency`
- `trips_update_owner_or_agency`

Complemento em `supabase/rls_phase_2_fix.sql`:

- `agencies_insert_owner`
- `agency_members_insert_owner_or_master`
- `agency_members_update_owner_or_master`

## Inconsistencias encontradas entre codigo e banco

- O `RouteGuard` ainda redirecionava para `/login` sem preservar a rota original.
- Login, cadastro e cadastro de agencia liam `redirect` de forma assincrona, mas podiam redirecionar antes de a URL ser interpretada.
- O `AuthContext` processava bootstrap inicial e `onAuthStateChange` sem deduplicacao leve, o que aumentava a chance de reexecucoes redundantes de `ensureProfile`.
- Falha temporaria em `loadProfile` limpava o `profile` em memoria, o que causava sumico de nome e avatar mesmo com sessao valida.
- `profiles-repository` ainda mantinha fallback local com estrutura valida, mas o `profile` real precisava continuar sendo a fonte principal quando Supabase estivesse ativo.

## Onde localStorage/mock ainda interfere

- `app/portal/configuracoes/page.tsx`
  - continua usando `localStorage` como fallback offline, mas nao deve mais sobrescrever o profile real quando Supabase esta ativo
- `lib/repositories/profiles-repository.ts`
  - ainda oferece fallback local para ambiente sem Supabase
- `contexts/trips-context.tsx`
  - continua persistindo viagens e creditos localmente quando Supabase nao esta ativo

Observacao:
- No fluxo estabilizado desta fase, `profiles` do Supabase e a sessao do Auth sao a fonte principal para header, dashboard e configuracoes quando `NEXT_PUBLIC_USE_SUPABASE_DATA=true`.

## Causa dos loops e instabilidades de auth

- Redirect sem callback no `RouteGuard`, causando login sem retorno seguro para a rota protegida.
- Redirect automatico nas telas de auth antes de o `redirect` da query string estar resolvido.
- Duplicacao de bootstrap entre `getSession()` e `onAuthStateChange`, com recarga redundante de `profile`.
- Limpeza agressiva de `profile` em caso de erro temporario, produzindo flicker de nome/avatar e sensacao de logout parcial.

## Correcoes aplicadas

- `RouteGuard` agora redireciona para `/login?redirect=ROTA_ATUAL`.
- Criado helper `lib/auth/safe-redirect.ts` para leitura e sanitizacao de redirect.
- Login, cadastro e cadastro da agencia agora esperam o `redirect` ser resolvido antes de qualquer redirecionamento automatico.
- `AuthContext` ganhou deduplicacao leve por assinatura de sessao.
- `AuthContext` preserva o `profile` em memoria em caso de erro temporario de leitura, evitando sumico de nome/foto durante refresh.
- `refreshProfile()` continua sem ligar loading global.

## Arquivos alterados nesta rodada

- `contexts/auth-context.tsx`
- `components/auth/route-guard.tsx`
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/agency/signup/page.tsx`
- `lib/auth/safe-redirect.ts`

## Testes realizados

- Build de producao com `pnpm run build`
- Revisao do fluxo de bootstrap:
  - `getSession`
  - `onAuthStateChange`
  - `ensureProfile`
  - redirect de rotas protegidas
  - redirect pos-login

## SQL recomendado

Nenhum SQL novo e obrigatorio foi identificado nesta rodada para estabilizar auth/profile/bootstrap.

Se ainda houver falha de permissao em criacao de agencia no ambiente, o SQL relevante continua sendo:

- `supabase/rls_phase_2_fix.sql`

## Riscos restantes

- `app/agencia/configuracoes/page.tsx` ainda usa estado local proprio; nao foi alterada nesta rodada para manter o escopo focado em auth/profile/bootstrap.
- Algumas telas antigas ainda exibem mocks visuais secundarios, mas nao devem mais ser a fonte principal do profile no portal do usuario quando Supabase estiver ativo.
- A validacao final de comportamento em refresh/F5 precisa ser confirmada no navegador real, porque daqui a verificacao foi por leitura de fluxo e build.
